import * as fs from 'fs'
import * as vscode from 'vscode'

import * as config from './config'
import * as tools from './tools'
import * as dialogs from './dialogs'

export async function setCacheDirectoryCmd(): Promise<string | undefined> {
    const currentCachePath = await config.getCachePath()

    const selectedPaths = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: currentCachePath.isOk() ? vscode.Uri.file(currentCachePath.unwrap()) : undefined,
        title: 'Select the location where template caches will be saved in'
    })

    if(selectedPaths) {
        const path = selectedPaths[0].fsPath
        await config.setCachePath(path)
        vscode.window.showInformationMessage('The cache directory has been updated')
        return path
    }

    return undefined
}

// -- TODO (command): Set Cache Directory
// -- TODO (command): New Template Cache (create a cache folder for a given template)
// -- TODO (command): Delete Template Cache
// TODO (update): Template fetching must fetch from cache if possible
// TODO (update): Template deletion must include template cache if there is one
// TODO (command): Force Fetch (same as fetch, but will update cache (if there is one) first and then fetch from cache)

export async function newTemplateCacheCmd() {
    const template = await dialogs.selectTemplate({
        placeHolder: 'Select a template to create a cache for',
        filter: template => template.cacheName === undefined
    })
    if(template) {
        newTemplateCache(template)
    }
}

export async function newTemplateCache(template: config.TemplateInfo) {
    const templateCacheName = tools.generateStringIdentifier()
    const cachePath = await tools.tryToGetCachePath()

    if(cachePath) {
        const templateCachePath = `${cachePath}/${templateCacheName}`
        try {
            await fs.promises.mkdir(templateCachePath)
            template.cacheName = templateCacheName
            await config.createOrUpdateTemplate(template)
            vscode.window.showInformationMessage(`'${template.name}' template cache has been created at ${templateCachePath}`)
        } catch(err) {
            vscode.window.showErrorMessage(`Failed to create ${templateCachePath}: ${err}`)
        }
    }
}

export async function deleteTemplateCacheCmd() {
    const template = await dialogs.selectTemplate({
        placeHolder: 'Select a template to delete the cache of',
        filter: template => template.cacheName !== undefined
    })
    if(template) {
        deleteTemplateCache(template)
    }
}

export async function deleteTemplateCache(template: config.TemplateInfo) {
    const cachePath = await tools.tryToGetCachePath()

    if(cachePath) {
        const templateCachePath = `${cachePath}/${template.cacheName as string}`
        try {
            await fs.promises.rmdir(templateCachePath, {recursive: true})
            template.cacheName = undefined
            await config.createOrUpdateTemplate(template)
            vscode.window.showInformationMessage(`'${template.name}' template cache has been deleted`)
        } catch(err) {
            vscode.window.showErrorMessage(`Failed to delete ${templateCachePath}: ${err}`)
        }
    }
}