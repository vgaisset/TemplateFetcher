import { Ensures, NotEmpty } from "../checkDecorators"
import { ErrorResult, OkResult, Result } from "../tools"

const useFileProtocolRegex = /^file:\/\/.*/
const useHttpProtocolRegex = /^https?:\/\/.*/
const useFtpProtocolRegex = /^ftp:\/\/.*/
const useAnyProtocolRegex = /^.*:\/\/.*/

export type UriProtocol = 'none' | 'file' | 'ftp' | 'http'

export class Uri {
    @NotEmpty(v => v.trim())
    value: string
    private protocol: UriProtocol
    
    private constructor(value: string, protocol: UriProtocol) {
        this.value = value
        this.protocol = protocol
    }

    static from(uri: string): Result<Uri, string> {
        if(uri.trim().length == 0) {
            return new ErrorResult('An URI can not be empty')
        }

        const protocol = Uri.findProtocolOf(uri)

        if(protocol === "unsupported") {
            return new ErrorResult(`The given URI uses a unsupported protocol (accepted: file://, http(s)://, ftp://)`)
        }

        return new OkResult(new Uri(uri, protocol))
    }

    getProtocol(): UriProtocol {
        return this.protocol
    }

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
    static findProtocolOf(uri: string): UriProtocol | 'unsupported' {
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
}