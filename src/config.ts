import * as vscode from 'vscode'
import * as fs from 'fs'

import { Logger } from './logger'
import { ErrorResult, OkResult, Result } from './tools'

let logger = new Logger('[Config]')

const templateFetcherID = 'templatefetcher'
const templatesID = 'templates'
const cachePathID = 'cachePath'

const storeTemplatesInfoGlobally = true
const storeCachePathGlobally = true

export interface TemplateInfo {
    /**
     * The name representing the template.
     */
    name: string
    /**
     * Template location. It can be an absolute path or an URL.
     */
    uri: string,
    /**
     * If the template is a directory, how many leading directories must be discarded ?
     */
    discardedLeadingDirectories?: number,
    /**
     * Specify if the file is an archive or not.
     * If so, content will be extracted.
     * **discardedLeadingDirectories** also applies on archives.
     */
    isArchive: boolean,
    /**
     * Name of the template cache folder.
     */
    cacheName?: string
}

/**
 * Retrieves different templates informations written in user config file.
 * @returns map of TemplateConfig, indexed by their names.
 */
export function getTemplates(): Map<string, TemplateInfo> {
    let map = new Map<string, TemplateInfo>()

    const templatesObj = vscode.workspace.getConfiguration(templateFetcherID).get(templatesID) as any

    for(const templateName in templatesObj) {
        let template = templatesObj[templateName] as TemplateInfo
        template.name = templateName

        map.set(templateName, template)
    }

    return map
}

/**
 * Checks validity of the different template parameters.
 * If some parameters are omitted, then default values are affected.
 * @param templateName
 * @param templateInfo 
 */
export function checkAndCleanTemplateInfo(templateInfo: TemplateInfo): boolean {
    if(templateInfo.uri === undefined) {
        logConfigError(templateInfo.name, 'uri', 'URI field is mandatory in order to fetch project template')
        return false
    }
    if(templateInfo.uri.trim().length === 0) {
        logConfigError(templateInfo.name, 'uri', 'An URI can not be empty')
        return false
    }

    if(templateInfo.discardedLeadingDirectories === undefined) {
        templateInfo.discardedLeadingDirectories = 0
    } else {
        if(templateInfo.discardedLeadingDirectories < 0) {
            logConfigError(templateInfo.name, 'directoryDepth', 'The directory depth can not have a negative value')
            return false
        }
    }

    if(templateInfo.isArchive === undefined) {
        templateInfo.isArchive = false
    }

    return true
}

/**
 * Saves a template in user's settings.
 * @param template 
 */
export async function createOrUpdateTemplate(template: TemplateInfo) {
    let wsConfig = vscode.workspace.getConfiguration(templateFetcherID)
    let templates = wsConfig.get(templatesID) as any

    templates[template.name] = {
        uri: template.uri,
        discardedLeadingDirectories: template.discardedLeadingDirectories,
        isArchive: template.isArchive,
        cacheName: template.cacheName,
    }

    await wsConfig.update(templatesID, templates, storeTemplatesInfoGlobally)
}

/**
 * Deletes a template from user's settings, using template name as key.
 * @param template 
 * @returns true if the template has been deleted, false otherwise
 */
export async function deleteTemplate(template: TemplateInfo): Promise<boolean> {
    let wsConfig = vscode.workspace.getConfiguration(templateFetcherID)
    let templates = wsConfig.get(templatesID) as any

    if(templates.hasOwnProperty(template.name)) {
        templates[template.name] = undefined
        await wsConfig.update(templatesID, templates, storeTemplatesInfoGlobally)
        return true
    } 
    
    return false
}

export enum CachePathErrors {
    INVALID_PATH,
    NOT_A_DIRECTORY,
    PATH_NOT_SET
}
export async function getCachePath(): Promise<Result<string, CachePathErrors>> {
    let wsConfig = vscode.workspace.getConfiguration(templateFetcherID)
    let cachePath = wsConfig.get(cachePathID) as string

    if(cachePath) {
        try {
            const stats = await fs.promises.stat(cachePath)
            if(stats.isDirectory()) {
                return new OkResult(cachePath)
            }
        } catch(err) {
            return new ErrorResult(CachePathErrors.INVALID_PATH)
        }

        return new ErrorResult(CachePathErrors.NOT_A_DIRECTORY)
    } 
    return new ErrorResult(CachePathErrors.PATH_NOT_SET)
}

export async function setCachePath(newCachePath: string) {
    let wsConfig = vscode.workspace.getConfiguration(templateFetcherID)
    await wsConfig.update(cachePathID, newCachePath, storeCachePathGlobally)
}

function logConfigError(itemName: string, itemFieldName: string, reason: string) {
    logger.error(`On template "${itemName}":"${itemFieldName}" : ${reason}`)
}