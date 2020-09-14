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
