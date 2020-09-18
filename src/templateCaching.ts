import { resolve } from 'path'
import { stringify } from 'querystring'
import * as vscode from 'vscode'

import * as config from './config'
import { ErrorResult, Result } from './tools'

export async function setCacheDirectoryCmd() {
    const currentCachePath = await config.getCachePath()

    const selectedPaths = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: currentCachePath.isOk() ? vscode.Uri.file(currentCachePath.unwrap()) : undefined,
        title: 'Select the location where template caches will be saved in'
    })

    if(selectedPaths) {
        await config.setCachePath(selectedPaths[0].fsPath)
        vscode.window.showInformationMessage('The cache directory has been updated')
    }
}

// -- TODO (command): Set Cache Directory
// TODO (command): New Template Cache (create a cache folder for a given template)
// TODO (update): Template fetching must fetch from cache if possible
// TODO (command): Force Fetch (same as fetch, but will update cache (if there is one) first and then fetch from cache)
export async function templateCachingCmd() {
    const cachePath = await config.getCachePath()

    if(cachePath.isOk()) {
        cachePath.unwrap()
    } else {
        const err = cachePath.unwrap() as config.CachePathErrors

        let errorMessage = 'Unknown error'
        switch(err) {
            case config.CachePathErrors.INVALID_PATH:
                errorMessage = 'The cache path is not a valid path'
                break
            case config.CachePathErrors.NOT_A_DIRECTORY:
                errorMessage = 'The cache path does not lead to a directory'
                break
            case config.CachePathErrors.PATH_NOT_SET:
                errorMessage = 'There is no cache path set'
            break
        }

        const editCachePath = await vscode.window.showErrorMessage(errorMessage, 'Edit cache path')
        if(editCachePath) {
            
        }
    }
}