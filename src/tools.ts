import * as vscode from 'vscode'

import * as config from './config'

/**
 * Generates a random integer
 * @param min 
 * @param max 
 * @throws an Error if max < min
 */
export function randomInt(min: number, max: number) {
    if(max < min) {
        throw new Error(`Tried to generate a random integer between [${min};${max}]`)
    }
    return Math.ceil(min + Math.random() * (max - min))
}

export function generateStringIdentifier(): string {
    const now = new Date()
    
    let identifier = String(now.getFullYear())
    identifier += String(now.getMonth() + 1).padStart(2, '0')
    identifier += String(now.getDate()).padStart(2, '0')
    identifier += String(now.getHours()).padStart(2, '0')
    identifier += String(now.getMinutes()).padStart(2, '0')
    identifier += String(now.getSeconds()).padStart(2, '0')
    identifier += String(now.getMilliseconds()).padStart(3, '0')
    identifier += String(randomInt(0, 9999)).padStart(4, '0')
    
    return identifier
}

export async function tryToGetCachePath(): Promise<string | undefined> {
    const cachePath = await config.getCachePath()

    if(cachePath.isOk()) {
        return cachePath.unwrap()
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
            const selectedPath: string | undefined = await vscode.commands.executeCommand('templatefetcher.setCachePath')

            if(selectedPath) {
                return selectedPath
            }
        }
    }

    return undefined
}
export interface Result<TYPE, ERROR> {
    isOk(): this is OkResult<TYPE, ERROR>
    isError(): this is ErrorResult<TYPE, ERROR>
    unwrap(): TYPE | ERROR
}

export class OkResult<TYPE, ERROR> implements Result<TYPE, ERROR> {
    constructor(protected value: TYPE) {}
    
    isOk(): this is OkResult<TYPE, ERROR> {
        return true
    }
    
    isError(): this is ErrorResult<TYPE, ERROR> {
        return false
    }   

    unwrap(): TYPE {
        return this.value
    }
}

export class ErrorResult<TYPE, ERROR> implements Result<TYPE, ERROR> {
    constructor(protected value: ERROR) {}

    isOk(): this is OkResult<TYPE, ERROR> {
        return false
    }

    isError(): this is ErrorResult<TYPE, ERROR> {
        return true
    }   

    unwrap(): ERROR {
        return this.value
    }
}
