import getUri = require("get-uri")
import ncp = require("ncp")
import path = require("path")
import util = require("util")
import fs = require("fs")
import decompress = require("decompress")

import { LoggerService } from "../domain/services/loggerService"
import { Uri } from "../domain/Uri"
import { FetchService } from "../domain/services/fetchService"
import { Template } from "../domain/Template"
import * as dialogs from "../dialogs"

export class VscodeFetchService implements FetchService {
    constructor(private logger: LoggerService) {}

    async fetch(template: Template, targetDirectory: string): Promise<void> {
        this.logger.info(`Fetching from "${template.uri}" to "${targetDirectory}"`)
        
        try {
            const isDirectory = await template.uri.isDirectory()

            if(isDirectory || template.isArchive) {
                template.discardedLeadingDirectories = await dialogs.confirmDirectoryDepth(template.discardedLeadingDirectories || 0)
            }
            if(isDirectory) {
                await this.fetchFromDirectory(template.uri.value, template.discardedLeadingDirectories || 0, targetDirectory)
            } else {
                await this.fetchFromFile(template.uri, targetDirectory, template.isArchive ? {
                    discardedLeadingDirectories: template.discardedLeadingDirectories || 0
                } : undefined)
            }
        } catch(err) {
            this.logger.error(err.message)
            return
        }
        this.logger.info("Done")
    }

    async fetchFromDirectory(srcDirectory: string, discardedLeadingDirectories: number, targetDirectory: string): Promise<void> {
        let [directoryPath, copyOnlyContent] = discardLeadingDirectories(srcDirectory, discardedLeadingDirectories)

        const targetDirectorySuffix = '/' + (copyOnlyContent ? '' : path.basename(directoryPath))
    
        let ncpAsync = util.promisify(ncp)
        const errors = await ncpAsync(directoryPath, targetDirectory + targetDirectorySuffix) as Error[] | undefined
        
        if(errors) {
            errors.forEach(err => {
                if(err) {
                    throw new Error(`When copying directory located at ${directoryPath}/ : ${err}`)
                }
            })
        } 
    }

    async fetchFromFile(srcUri: Uri, targetDirectory: string, archiveOptions?: { discardedLeadingDirectories: number }): Promise<void> {
        const error: string | undefined = await new Promise((ok, _) => {
            const uriHasProtocol = srcUri.getProtocol() != "none"
    
            getUri(uriHasProtocol ? srcUri.value : `file:///${srcUri.value}`, (err, res) => {
                if(err) {
                    ok(err.message)
                } 
                
                let chunks: any[] = []
    
                res?.on('data', (chunk: any) => {
                    chunks.push(chunk)
                })
                res?.on('end', async () => {
                    const buffer = Buffer.concat(chunks)
                    
                    if(archiveOptions) {
                        await extractArchive(buffer, archiveOptions.discardedLeadingDirectories, targetDirectory, this.logger)
                    } else {
                        await fs.promises.writeFile(targetDirectory + '/' + path.basename(srcUri.value), buffer)
                    }
                    ok(undefined)
                })
            })
        })

        if(error) throw new Error(error)
    }
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

async function extractArchive(buffer: Buffer, discardedLeadingDirectories: number, targetDirecotry: string, logger: LoggerService) {
    logger.info('Extracting files...')

    const files = await decompress(buffer, targetDirecotry, {
     	strip: discardedLeadingDirectories
    })

    logger.info(`${files.length} files have been extracted`)
    if(files.length == 0) {
        logger.warning('There is currently no error detection for archive extraction. Therefore, the extraction may have failed. At the moment, only .zip should work')
    }
    logger.info('Done')
}