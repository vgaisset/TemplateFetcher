import * as vscode from 'vscode'
import * as fs from 'fs'
import * as getUri from 'get-uri'
import * as decompress from 'decompress'
import * as path from 'path'
import * as ncp from 'ncp'

import { Logger } from './logger'
import * as config from './config'
import * as dialogs from './dialogs'
import * as tools from './tools'

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
export default async function fetchCmd(target: vscode.Uri) {
    if(target === undefined) {
        const workspacesFolder = vscode.workspace.workspaceFolders

        if(workspacesFolder) {
            target = workspacesFolder[0].uri
        } else {
            await vscode.window.showErrorMessage('No target directory is provided and there is no open workspace')
        }
        logger.warning(`No target directory is specified, going to use '${target.fsPath}' instead`)
    }

    if(config.getTemplates().size === 0) {
        const value = await vscode.window.showErrorMessage('There are no templates defined', 'New template')

        if(value === 'New template') {
            vscode.commands.executeCommand('templatefetcher.newTemplate')
        }

        return new Promise((ok, _) => { ok() })
    }

    const template = await dialogs.selectTemplate({
        placeHolder: 'Select a template to fetch'
    })

    if(template) {        
        await fetchTemplate(template, target)
        return
    }
    
    vscode.window.showErrorMessage('Template fetching cancelled')
}

async function fetchTemplate(template: config.TemplateInfo, targetDirectory: vscode.Uri) {
    if(config.checkAndCleanTemplateInfo(template)) {
        logger.info(`Using template "${template.name}"`)
        logger.info(`Fetching from "${template.uri}"`)
        
        try {
            const templateType = findTemplateUriType(template)

            if(templateType == TemplateType.DIRECTORY || templateType == TemplateType.ARCHIVE) {
                template.discardedLeadingDirectories = await confirmDirectoryDepth(template.discardedLeadingDirectories)
                logger.takeFocus()
            }
            if(templateType == TemplateType.DIRECTORY) {
                fetchFromDirectory(template.uri, template.discardedLeadingDirectories, targetDirectory)
            } else {
                fetchFromFile(template.uri, targetDirectory, template.isArchive ? {
                    discardedLeadingDirectories: template.discardedLeadingDirectories
                } : undefined)
            }
        } catch(err) {
            logger.error(err.message)
            logger.takeFocus()
        }
    }
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
 * @param template 
 */
function findTemplateUriType(template: config.TemplateInfo): TemplateType {
    const uriProtocol = tools.getUriProtocol(template.uri)
    const isFilesystemUri = uriProtocol == "file" || uriProtocol == "none"
    
    if(isFilesystemUri && fs.statSync(template.uri).isDirectory()) {
        return TemplateType.DIRECTORY
    }

    return template.isArchive ? TemplateType.ARCHIVE : TemplateType.FILE
}

/**
 * Fetches from a filesystem directory.
 * @param template 
 * @param targetDirectory Where the template must be copied to.
 */
function fetchFromDirectory(srcUri: string, discardedLeadingDirectories: number, targetDirectory: vscode.Uri) {
    let [directoryPath, copyOnlyContent] = discardLeadingDirectories(srcUri, discardedLeadingDirectories)

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
 * @param template 
 * @param targetDirectory 
 * @param discardedLeadingDirectories If the file is an archive, how many leading directories must be discarded ? 
 * If the value is undefined, then the file will NOT be considered as an archive.
 */
function fetchFromFile(srcUri: string, targetDirectory: vscode.Uri, archiveOptions?: {discardedLeadingDirectories: number}) {
    const uriHasProtocol = tools.getUriProtocol(srcUri) != "none"

    getUri(uriHasProtocol ? srcUri : `file:///${srcUri}`, (err, res) => {
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
            
            if(archiveOptions) {
                extractArchive(buffer, archiveOptions.discardedLeadingDirectories, targetDirectory)
            } else {
                fs.writeFile(targetDirectory.fsPath + '/' + path.basename(srcUri), buffer, () => {
                    logger.info('Done')
                })
            }
        })
    })
}

async function extractArchive(buffer: Buffer, discardedLeadingDirectories: number, targetDirecotry: vscode.Uri) {
    logger.info('Extracting files...')

    const files = await decompress(buffer, targetDirecotry.fsPath, {
     	strip: discardedLeadingDirectories
    })

    logger.info(`${files.length} files have been extracted`)
    if(files.length == 0) {
        logger.warning('There is currently no error detection for archive extraction. Therefore, the extraction may have failed. At the moment, only .zip should work')
    }
    logger.info('Done')
}

