import * as vscode from 'vscode'
import * as fs from 'fs'

import { assertPropertyValidity, ErrorResult, OkResult, Result } from './tools'
import { Template } from './domain/Template'
import { Uri } from './domain/Uri'

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
                templateName, 
                new Uri(assertPropertyValidity(configTemplate.uri, 'uri', "string")), 
                assertPropertyValidity(configTemplate.isArchive, 'isArchive', "undefined", "boolean"), 
                assertPropertyValidity(configTemplate.discardedLeadingDirectories, 'discardedLeadingDirectories', "undefined", "number"), 
                assertPropertyValidity(configTemplate.cacheName, 'cacheName', "undefined", "string")
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
 * Saves a template in user's settings.
 * @param template 
 */
export async function createOrUpdateTemplate(template: Template) {
    let wsConfig = vscode.workspace.getConfiguration(templateFetcherID)
    let templates = wsConfig.get(templatesID) as any

    templates[template.name] = {
        uri: template.uri.value,
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
    assertPropertyValidity(cachePath, 'cachePath', "undefined", "string")

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
