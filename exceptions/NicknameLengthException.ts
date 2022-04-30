export class NicknameLengthException extends Error {
    constructor(m: string) {
        super(m);

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, NicknameLengthException.prototype);
    }
}
