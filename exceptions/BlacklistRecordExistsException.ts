export class BlacklistRecordExistsException extends Error {
    constructor(m: string) {
        super(m);

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, BlacklistRecordExistsException.prototype);
    }
}