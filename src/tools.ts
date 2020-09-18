import { timingSafeEqual } from "crypto"

const useFileProtocolRegex = /^file:\/\/.*/
const useHttpProtocolRegex = /^https?:\/\/.*/
const useFtpProtocolRegex = /^ftp:\/\/.*/
const useAnyProtocolRegex = /^.*:\/\/.*/

/**
 * Checks if a given URI is an URL by returning the used protocol.
 * Two special values can be returned :
 * 
 * * 'none' if there is no protocol
 * * 'unsupported' if there is a protocol the extension does not support
 * 
 * *Note: 'http' stands for both http and https protocols*
 * @param uri 
 */
export function getUriProtocol(uri: string): 'none' | 'unsupported' | 'file' | 'ftp' | 'http' {
    if(useFileProtocolRegex.test(uri)) {
        return "file"
    } else if(useHttpProtocolRegex.test(uri)) {
        return "http"
    } else if(useFtpProtocolRegex.test(uri)) {
        return "ftp"
    } else if(useAnyProtocolRegex.test(uri)) {
        return "unsupported"
    } else {
        return "none"
    }
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

    static promise<TYPE, ERROR>(value: TYPE): Promise<OkResult<TYPE, ERROR>> {
        return new Promise(ok => ok(new OkResult<TYPE, ERROR>(value)))
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

    static promise<TYPE, ERROR>(error: ERROR): Promise<ErrorResult<TYPE, ERROR>> {
        return new Promise(ok => ok(new ErrorResult<TYPE, ERROR>(error)))
    }
}
