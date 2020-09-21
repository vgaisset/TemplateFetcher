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

    const template = await dialogs.selectTemplate({
        placeHolder: 'Select a template to fetch'
    })

    if(template) {        
        await template.fetch(target)
        return
    }

    const selection = config.getTemplates()
    if(selection.invalidTemplateErrors.length != 0)
    if(selection.validTemplates.size === 0) {
        let value: string | undefined
        if(selection.invalidTemplateErrors.length != 0) {
            value = await vscode.window.showErrorMessage('There are no valid templates', 'New template', 'Edit templates')
        } else {
            value = await vscode.window.showErrorMessage('There are no templates defined', 'New template')
        }

        if(value === 'New template') {
            vscode.commands.executeCommand('templatefetcher.newTemplate')
        } else if(value == 'Edit templates') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'templatefetcher.templates')
        }
        return
    }
}

/**
 * Fetches from a filesystem directory.
 * @param template 
 * @param targetDirectory Where the template must be copied to.
 */
export function fetchFromDirectory(srcUri: string, discardedLeadingDirectories: number, targetDirectory: vscode.Uri) {
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
export function fetchFromFile(srcUri: string, targetDirectory: vscode.Uri, archiveOptions?: {discardedLeadingDirectories: number}) {
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

