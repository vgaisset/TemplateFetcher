import * as vscode from 'vscode'
import * as fs from 'fs'
import * as getUri from 'get-uri'
import * as decompress from 'decompress'
import * as path from 'path'
import * as ncp from 'ncp'

import { Logger } from './logger'
import * as config from './config'

enum TemplateType {
    /**
     * A new file is created on the requested directory
     * using the template filename, and then the content is copied.
     */
    FILE,
    /**
     * The template directory is copied into the requested directory.
     * The config parameter 'directoryDepth' can be used in order to indicate from how many leading directories must be discarded.
     */
    DIRECTORY,
    /**
     * Same behavior as DIRECTORY.
     * In order to consider a file as archive, use the config parameter 'isArchive'.
     */
    ARCHIVE,
}

const logger = new Logger('[Fetcher]')

/**
 * Fetch command.
 * It asks to user the template to fetch and then fetchs it.
 * @param target Where to fetch the template in
 */
export default async function fetchCmd(target: vscode.Uri): Promise<void> {
    if(target === undefined) {
        const workspacesFolder = vscode.workspace.workspaceFolders

        if(workspacesFolder) {
            target = workspacesFolder[0].uri
        } else {
            await vscode.window.showErrorMessage('No target directory is provided and there is no open workspace')
            return new Promise((ok, _) => { ok() })
        }
        logger.warning(`No target directory is specified, going to use '${target.fsPath}' instead`)
    }

    const templatesInfo = config.getTemplatesInfo()

    if(templatesInfo.size === 0) {
        vscode.window.showErrorMessage('There are no templates defined', 'New template').then(value => {
            if(value === 'New template') {
                vscode.commands.executeCommand('templatefetcher.newTemplate')
            }
        })
        return new Promise((ok, _) => { ok() })
    }

    const templateNames = Array.from(templatesInfo.keys())
    const templateName = await vscode.window.showQuickPick(templateNames, {placeHolder: 'Select the template to fetch'})

    if(templateName) {
        const templateInfo = templatesInfo.get(templateName) as config.TemplateInfo
        
        if(config.checkAndCleanTemplateInfo(templateInfo)) {
            logger.info(`Using template "${templateName}"`)
            logger.info(`Fetching from "${templateInfo.uri}"`)
            
            try {
                const templateType = findTemplateUriType(templateName, templateInfo)

                if(templateType == TemplateType.DIRECTORY || templateType == TemplateType.ARCHIVE) {
                    templateInfo.directoryDepth = await confirmDirectoryDepth(templateInfo.directoryDepth)
                    logger.takeFocus()
                }
                if(templateType == TemplateType.DIRECTORY) {
                    fetchFromDirectory(templateInfo, target)
                } else {
                    fetchFromFile(templateInfo, target)
                }
            } catch(err) {
                logger.error(err.message)
                logger.takeFocus()
            }

            return new Promise((ok, _) => { ok() })
        }
    }
    
    vscode.window.showErrorMessage('Template fetching cancelled')
    return new Promise((ok, _) => { ok() })
}

async function confirmDirectoryDepth(directoryDepth: number): Promise<number> {
    while(true) {
        const numberStr = await vscode.window.showInputBox({value: `${directoryDepth}`, prompt: 'How many leading directories must be discarded ?'})
        if(numberStr === undefined) {
            return new Promise((ok, _) => { ok(directoryDepth) })
        }

        const number = Number(numberStr)

        if(Number.isNaN(number) || number < 0 || !Number.isInteger(number)) {
            vscode.window.showErrorMessage('The directory depth must be a positive integer. It indicates how many leading directories must be discarded')
        } else {
            return new Promise((ok, _) => { ok(number) })
        }
    }
}

/**
 * Determines if a template URI is a file, a directory or an archive.
 * This function does not guarantee the URI validity.
 * @param templateName 
 * @param templateInfo 
 */
function findTemplateUriType(templateName: string, templateInfo: config.TemplateInfo): TemplateType {
    const isFilesystemUri = !isHttpUri(templateInfo.uri)
    
    if(isFilesystemUri && fs.statSync(templateInfo.uri).isDirectory()) {
        if(templateInfo.isArchive) {
            logger.info(`The template ${templateName} uses a template directory but has 'isArchive' field to true`)
        }
        return TemplateType.DIRECTORY
    }

    return templateInfo.isArchive ? TemplateType.ARCHIVE : TemplateType.FILE
}

function isHttpUri(uri: string) {
    const htmlRegex = /^https?:\/\/.*/
    return  htmlRegex.test(uri)
}

/**
 * Fetches from a filesystem directory.
 * @param templateInfo 
 * @param targetDirectory Where the template must be copied to.
 */
function fetchFromDirectory(templateInfo: config.TemplateInfo, targetDirectory: vscode.Uri) {
    let [directoryPath, copyOnlyContent] = discardLeadingDirectories(templateInfo.uri, templateInfo.directoryDepth)

    const targetDirectorySuffix = '/' + (copyOnlyContent ? '' : path.basename(directoryPath))

    ncp(directoryPath, targetDirectory.fsPath + targetDirectorySuffix, errors => {
        if(errors) {
            errors.forEach(err => {
                if(err) {
                    logger.error(`When copying directory located at ${directoryPath}/ : ${err}`)
                }
            })
        } else {
            logger.info('Done')
        }
    })
}

/**
 * Given a base directory path and a maximum lookup depth, it tries to get the longest
 * directory path by discarding leading directories.
 * @param directoryPath 
 * @param maxDepth 
 * @returns The longest path found and a boolean specifying if only the directory content must be copied.
 */
function discardLeadingDirectories(directoryPath: string, maxDepth: number): [string, boolean] {
    let remainingDepth = maxDepth

    for(let i = 0; i < maxDepth; i++) {
        const dir = fs.opendirSync(directoryPath)
        
        const entry = dir.readSync()
        const hasAnotherEntry = dir.readSync() != null

        if(hasAnotherEntry || !entry.isDirectory()) {
            // We stop eliminating leading directories
            break;
        }
        
        directoryPath += '/' + entry.name
        remainingDepth--
    }

    return [
        directoryPath,
        remainingDepth != 0
    ]
}

/**
 * Fetches from a filesystem file or from an http URL.
 * @param templateInfo 
 * @param targetDirectory 
 */
function fetchFromFile(templateInfo: config.TemplateInfo, targetDirectory: vscode.Uri) {
    getUri(isHttpUri(templateInfo.uri) ? templateInfo.uri : `file:///${templateInfo.uri}`, (err, res) => {
        if(err) {
            logger.error(err.message)
            return
        } 
        
        let chunks: any[] = []

        res?.on('data', (chunk: any) => {
            chunks.push(chunk)
        })
        res?.on('end', () => {
            const buffer = Buffer.concat(chunks)

            if(templateInfo.isArchive) {
                extractArchive(buffer, templateInfo, targetDirectory)
            } else {
                fs.writeFile(targetDirectory.fsPath + '/' + path.basename(templateInfo.uri), buffer, () => {
                    logger.info('Done')
                })
            }
        })
    })
}

function extractArchive(buffer: Buffer, templateInfo: config.TemplateInfo, targetDirecotry: vscode.Uri) {
    logger.info('Extracting files...')
    decompress(buffer, targetDirecotry.fsPath, {
     	strip: templateInfo.directoryDepth
    })
    .then(files => {
        logger.info(`${files.length} files have been extracted`)
        if(files.length == 0) {
            logger.warning('There is currently no error detection for archive extraction. Therefore, the extraction may have failed. At the moment, only .zip should work')
        }
        logger.info('Done')
    }, err => {
        logger.error(err)
    })
    .catch((reason) => {
        logger.error(`While unpacking files: ${reason}`)
    })
}

