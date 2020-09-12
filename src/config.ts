import * as vscode from 'vscode'
import { Logger } from './logger'

let logger = new Logger('[Config]')

const templatesConfigID = 'templatefetcher'
const configInfoID = 'templates'
const storeTemplatesInfoGlobally = true

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

/**
 * Retrieves different templates informations written in user config file.
 * @returns map of TemplateConfig, indexed by their names.
 */
export function getTemplates(): Map<string, TemplateInfo> {
    let map = new Map<string, TemplateInfo>()

    const templatesObj = vscode.workspace.getConfiguration(templatesConfigID).get(configInfoID) as any

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

    if(templateInfo.directoryDepth === undefined) {
        templateInfo.directoryDepth = 0
    } else {
        if(templateInfo.directoryDepth < 0) {
            logConfigError(templateInfo.name, 'directoryDepth', 'The directory depth can not have a negative value')
            return false
        }
    }

    if(templateInfo.isArchive === undefined) {
        templateInfo.isArchive = false
    }

    return true
}

export function createOrUpdateTemplate(template: TemplateInfo) {
    let wsConfig = vscode.workspace.getConfiguration(templatesConfigID)
    let templates = wsConfig.get(configInfoID) as any

    templates[template.name] = {
        uri: template.uri,
        directoryDepth: template.directoryDepth,
        isArchive: template.isArchive
    }

    wsConfig.update(configInfoID, templates, storeTemplatesInfoGlobally)
}

export function deleteTemplate(template: TemplateInfo): boolean {
    let wsConfig = vscode.workspace.getConfiguration(templatesConfigID)
    let templates = wsConfig.get(configInfoID) as any

    if(templates.hasOwnProperty(template.name)) {
        templates[template.name] = undefined
        wsConfig.update(configInfoID, templates, storeTemplatesInfoGlobally)
        return true
    } 
    
    return false
}

function logConfigError(itemName: string, itemFieldName: string, reason: string) {
    logger.error(`On template "${itemName}":"${itemFieldName}" : ${reason}`)
}