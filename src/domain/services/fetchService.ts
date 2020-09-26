
import { Template } from "../Template";
import { Uri } from "../Uri";

export interface FetchService {
    fetch(template: Template, targetDirectory: string): Promise<void>
    fetchFromDirectory(srcDirectory: string, discardedLeadingDirectories: number, targetDirectory: string): Promise<void>
    fetchFromFile(srcUri: Uri, targetDirectory: string, archiveOptions?: {discardedLeadingDirectories: number}): Promise<void>
}
