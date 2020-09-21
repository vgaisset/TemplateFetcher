import * as vscode from 'vscode'
import * as fs from 'fs'

import { Logger } from './logger'
import { ErrorResult, OkResult, Result } from './tools'
import { Template } from './Template'

let logger = new Logger('[Config]')

const templateFetcherID = 'templatefetcher'
const templatesID = 'templates'
const cachePathID = 'cachePath'

const storeTemplatesInfoGlobally = true
const storeCachePathGlobally = true

/**
 * Retrieves different templates informations written in user config file.
 * @returns map of TemplateConfig, indexed by their names.
 */
export function getTemplates(): { validTemplates: Map<string, Template>, invalidTemplateErrors: Array<string> } {
    let validTemplates = new Map<string, Template>()
    let invalidTemplateErrors = new Array<string>()

    const templatesObj = vscode.workspace.getConfiguration(templateFetcherID).get(templatesID) as any
    
    for(const templateName in templatesObj) {
        const configTemplate = templatesObj[templateName] 
        try {
            const template = new Template(
                templateName, configTemplate.uri, 
                configTemplate.isArchive, configTemplate.discardedLeadingDirectories, 
                configTemplate.cacheName
            )
    
            validTemplates.set(templateName, template)
        } catch(err) {
            invalidTemplateErrors.push(`'${templateName}' template has an error: ${err}`)
        }
    }

    return {
        validTemplates: validTemplates,
        invalidTemplateErrors: invalidTemplateErrors
    }
}

/**
 * Checks validity of the different template parameters.
 * If some parameters are omitted, then default values are affected.
 * @param templateName
 * @param template 
 */
export function checkAndCleanTemplateInfo(template: Template): boolean {
    if(template.uri === undefined) {
        logConfigError(template.name, 'uri', 'URI field is mandatory in order to fetch project template')
        return false
    }
    if(template.uri.trim().length === 0) {
        logConfigError(template.name, 'uri', 'An URI can not be empty')
        return false
    }

    if(template.discardedLeadingDirectories === undefined) {
        template.discardedLeadingDirectories = 0
    } else {
        if(template.discardedLeadingDirectories < 0) {
            logConfigError(template.name, 'directoryDepth', 'The directory depth can not have a negative value')
            return false
        }
    }

    if(template.isArchive === undefined) {
        template.isArchive = false
    }

    return true
}

/**
 * Saves a template in user's settings.
 * @param template 
 */
export async function createOrUpdateTemplate(template: Template) {
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
export async function deleteTemplate(template: Template): Promise<boolean> {
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