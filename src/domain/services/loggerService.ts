export interface LoggerService {
    log(msg: string): Promise<void>
    info(msg: string): Promise<void>
    warning(msg: string): Promise<void>
    error(msg: string): Promise<void>
    flush(): Promise<void>
}