import * as vscode from 'vscode'
import * as fs from 'fs'

import { fetchFromDirectory, fetchFromFile } from './templateFetching'
import { Logger } from './logger'
import * as tools from './tools'
import * as config from './config'
import * as dialogs from './dialogs'
import { Ensures, NotEmpty, NotNegative } from './checkDecorators'

let logger = new Logger('[Template]')

export class Template {
    /**
     * The name representing the template.
     */
    @NotEmpty(name => name.trim())
    name: string;
    /**
     * Template location. It can be an absolute path or an URL.
     */
    @NotEmpty(uri => uri.trim())
    uri: string;
    /**
     * If the template is a directory, how many leading directories must be discarded ?
     */
    @NotNegative()
    discardedLeadingDirectories: number;
    /**
     * Specify if the file is an archive or not.
     * If so, content will be extracted.
     * **discardedLeadingDirectories** also applies on archives.
     */
    isArchive: boolean;
    /**
     * Name of the template cache folder.
     */
    @Ensures<string | undefined>('Must be 21 characters long', v => v === undefined || v.length == 21)
    //@MatchRegex(/^[0-9]+/)
    cacheName?: string;

    constructor(name: string, uri: string, isArchive?: boolean, discardedLeadingDirectories?: number, cacheName?: string) {
        if(discardedLeadingDirectories === undefined) {
            discardedLeadingDirectories = 0
        }
        if(isArchive === undefined) {
            isArchive = false
        }

        this.name = name
        this.uri = uri
        this.discardedLeadingDirectories = discardedLeadingDirectories
        this.isArchive = isArchive
        this.cacheName = cacheName
    }

    async fetch(targetDirectory: vscode.Uri): Promise<void> {
        if(config.checkAndCleanTemplateInfo(this)) {
            logger.info(`Using template "${this.name}"`)
            logger.info(`Fetching from "${this.uri}"`)
            
            try {
                const templateType = await this.findUriType()
    
                if(templateType == TemplateType.DIRECTORY || templateType == TemplateType.ARCHIVE) {
                    this.discardedLeadingDirectories = await dialogs.confirmDirectoryDepth(this.discardedLeadingDirectories || 0)
                    logger.takeFocus()
                }
                if(templateType == TemplateType.DIRECTORY) {
                    fetchFromDirectory(this.uri, this.discardedLeadingDirectories || 0, targetDirectory)
                } else {
                    fetchFromFile(this.uri, targetDirectory, this.isArchive ? {
                        discardedLeadingDirectories: this.discardedLeadingDirectories || 0
                    } : undefined)
                }
            } catch(err) {
                logger.error(err.message)
                logger.takeFocus()
            }
        }
    }

    /**
     * Determines if a template URI is a file, a directory or an archive.
     * This function does not guarantee the URI validity.
     * @param template 
     */
    async findUriType(): Promise<TemplateType> {
        const uriProtocol = tools.getUriProtocol(this.uri)
        const isFilesystemUri = uriProtocol == "file" || uriProtocol == "none"
        
        if(isFilesystemUri && (await fs.promises.stat(this.uri)).isDirectory()) {
            return TemplateType.DIRECTORY
        }

        return this.isArchive ? TemplateType.ARCHIVE : TemplateType.FILE
    }

    async newCache(): Promise<tools.Result<string, any | undefined>> {
        const templateCacheName = tools.generateStringIdentifier()
        const cachePath = await tools.tryToGetCachePath()
    
        if(cachePath) {
            const templateCachePath = `${cachePath}/${templateCacheName}`
            try {
                await fs.promises.mkdir(templateCachePath)
                this.cacheName = templateCacheName
                return new tools.OkResult(this.cacheName)
            } catch(err) {
                return new tools.ErrorResult(err)
            }
        }

        return new tools.ErrorResult(undefined)
    }
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