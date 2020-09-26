import * as fs from 'fs'

import * as tools from '../tools'
import { Requires as Requires, MatchRegex, NotEmpty, NotNegative } from '../checkDecorators'
import { Uri } from './Uri'

export class Template {
    /**
     * The name representing the template.
     */
    @NotEmpty(name => name.trim())
    name: string;
    /**
     * Template location. It can be an absolute path or an URL.
     */
    uri: Uri;
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
    @Requires<string | undefined>('Must be 21 characters long', v => v === undefined || v.length == 21)
    @MatchRegex(/^[0-9]/)
    cacheName?: string;

    constructor(name: string, uri: Uri, isArchive?: boolean, discardedLeadingDirectories?: number, cacheName?: string) {
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
    
    /**
     * Determines if a template URI is a file, a directory or an archive.
     * This function does not guarantee the URI validity.
     * @param template 
     */
    async findUriType(): Promise<TemplateType> {
        const isFilesystemUri = this.uri.getProtocol() == "file" || this.uri.getProtocol() == "none"
        
        if(isFilesystemUri && (await fs.promises.stat(this.uri.value)).isDirectory()) {
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