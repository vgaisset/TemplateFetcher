import * as vscode from 'vscode'
import * as fs from 'fs'
import * as getUri from 'get-uri'
import * as decompress from 'decompress'
import * as path from 'path'
import * as ncp from 'ncp'

import { Logger } from './logger'

interface TemplateConfig {
    /**
     * Template location. It can be an absolute path or an URL.
     */
    uri: string,
    /**
     * If the template is a directory, how many leading directories must be discarded ?
     * If the value is 0, then the directory is copied.
     * If the value is 1, then only the directory **content** is copied.
     */
    directoryDepth: number,
    /**
     * Specify if the file is an archive or not.
     * If so, content will be extracted.
     * **directoryDepth** also applies on archives.
     */
    isArchive: boolean
}

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

const logger = new Logger()

export default function fetch(target: vscode.Uri) {
    const config = getConfig()

    if(config.size === 0) {
        vscode.window.showErrorMessage('There are no templates defined', 'Open settings (UI)', 'Open settings (JSON)').then(value => {
            if(value === 'Open settings (UI)') {
                vscode.commands.executeCommand( 'workbench.action.openSettings', 'Template Fetcher' );
            } else if(value === 'Open settings (JSON)') {
                vscode.commands.executeCommand( 'workbench.action.openSettingsJson', 'Template Fetcher');
            }
        })
        return
    }

    const templateNames = Array.from(config.keys())

    vscode.window.showQuickPick(templateNames).then(
        templateName => {
            if(templateName) {
                const templateInfo = config.get(templateName) as TemplateConfig
                
                if(checkAndCleanConfigItem(templateName, templateInfo)) {
                    logger.info(`Init project using rule "${templateName}"`)
                    logger.info(`Fetching template from "${templateInfo.uri}"`)
                    
                    try {
                        const templateType = findTemplateUriType(templateName, templateInfo)

                        if(templateType == TemplateType.DIRECTORY) {
                            fetchFromDirectory(templateInfo, target)
                        } else {
                            fetchFromFile(templateInfo, target)
                        }
                    } catch(err) {
                        logger.error(err.message)
                    }
    
                    return
                }
            }
            
            vscode.window.showErrorMessage('Template creation cancelled')
        }, 
        failureReason => {
            vscode.window.showErrorMessage(failureReason)
        }
    )
}

/**
 * Retrieves different templates informations written in user config file.
 */
function getConfig(): Map<string, TemplateConfig> {
    let map = new Map<string, TemplateConfig>()

    const config = vscode.workspace.getConfiguration('Templates')
    const templatesObj = config.get('Info') as any

    for(const templateName in templatesObj) {
        map.set(templateName, templatesObj[templateName])
    }

    return map
}

/**
 * Checks validity of the different template parameters.
 * If some parameters are omitted, then default values are affected.
 * @param templateName
 * @param templateInfo 
 */
function checkAndCleanConfigItem(templateName: string, templateInfo: TemplateConfig): boolean {
    if(templateInfo.uri === undefined) {
        logConfigError(templateName, 'uri', 'URI field is mandatory in order to fetch project template')
        return false
    }
    if(templateInfo.uri.trim().length === 0) {
        logConfigError(templateName, 'uri', 'An URI can not be empty')
        return false
    }

    if(templateInfo.directoryDepth === undefined) {
        templateInfo.directoryDepth = 0
    } else {
        if(templateInfo.directoryDepth < 0) {
            logConfigError(templateName, 'directoryDepth', 'The directory depth can not have a negative value')
            return false
        }
    }

    if(templateInfo.isArchive === undefined) {
        templateInfo.isArchive = false
    }

    return true
}

/**
 * Determines if a template URI is a file, a directory or an archive.
 * This function does not guarantee the URI validity.
 * @param templateName 
 * @param templateInfo 
 */
function findTemplateUriType(templateName: string, templateInfo: TemplateConfig): TemplateType {
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
function fetchFromDirectory(templateInfo: TemplateConfig, targetDirectory: vscode.Uri) {
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
            logger.info('--done')
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
function fetchFromFile(templateInfo: TemplateConfig, targetDirectory: vscode.Uri) {
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
                    logger.info('--done')
                })
            }
        })
    })
}

function extractArchive(buffer: Buffer, templateInfo: TemplateConfig, targetDirecotry: vscode.Uri) {
    logger.info('Unpacking files...')
    decompress(buffer, targetDirecotry.fsPath, {
     	strip: templateInfo.directoryDepth
    }).then(() => {
        logger.info('-- Done.')
    }).catch((reason) => {
        logger.error(`While unpacking files: ${reason}`)
    })
}

function logConfigError(itemName: string, itemFieldName: string, reason: string) {
    logger.error(`On template "${itemName}":"${itemFieldName}" : ${reason}`)
}
