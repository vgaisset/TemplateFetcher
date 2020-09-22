import * as fs from 'fs'
import * as vscode from 'vscode'

import * as config from './config'
import * as tools from './tools'
import * as dialogs from './dialogs'
import { Template } from './Template'

export async function setCacheDirectoryCmd(): Promise<string | undefined> {
    const path = await dialogs.askCachePath()

    if(path) {
        await config.setCachePath(path)
        vscode.window.showInformationMessage('The cache path has been updated')
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

export async function newTemplateCache(template: Template) {
    const newCacheName = await template.newCache()

    if(newCacheName.isOk()) {
        await config.createOrUpdateTemplate(template)
        vscode.window.showInformationMessage(`'${template.name}' template cache has been created at ${newCacheName}`)
    } else {
        const err = newCacheName.unwrap()

        if(err) {
            vscode.window.showErrorMessage(`Failed to create '${template.name}' cache: ${err}`)
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

export async function deleteTemplateCache(template: Template) {
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