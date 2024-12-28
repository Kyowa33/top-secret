import sha512 from 'crypto-js/sha512';
import sha256 from 'crypto-js/sha256';
import Binary from '../util/Binary.ts';

interface hashFct {
    (input : String) : any;
}

class HashAlgo {

    public static tabHashAlgos: HashAlgo[] = [
        new HashAlgo("SHA-512", sha512),
        new HashAlgo("SHA-256", sha256)
    ];

    private code: String;
    private fct: hashFct;

    constructor(code: String, fct: hashFct) {
        this.code = code;
        this.fct = fct;
    }

    public getCode(): String {
        return this.code;
    }

    public getFct(): hashFct {
        return this.fct;
    }

    public static fromCode(code:String) : HashAlgo | undefined {
        return this.tabHashAlgos.find((item) => item.getCode() === code);
    }
}

class Credentials {

    

    private hashAlgo: String;
    private passMaster: String;

    private hash: number[];
    private hashValid: boolean;

    constructor(hashAlgo?: String, passMaster?: String) {
        this.hashAlgo = hashAlgo || HashAlgo.tabHashAlgos[0].getCode();
        this.passMaster = passMaster || "";
        this.hashValid = false;
    }

    public getHashAlgo(): String {
        return this.hashAlgo;
    }

    public getPassMaster(): String {
        return this.passMaster;
    }

    public setHashAlgo(newHash: String) {
        this.hashAlgo = newHash;
        this.hashValid = false;
    }

    public setPassMaster(newPass: String) {
        this.passMaster = newPass;
        this.hashValid = false;
    }

    public getHash(): number[] {
        if (this.hashValid !== true) {
            let hashAlgoItem = HashAlgo.fromCode(this.hashAlgo);
            if (hashAlgoItem === undefined) {
                // Fall back to default hash algo
                hashAlgoItem = HashAlgo.tabHashAlgos[0];
            }

            let tabInt32 = hashAlgoItem.getFct()(this.getPassMaster()).words;
            this.hash = Binary.arrayInt32ToUint8(tabInt32);

            console.log("hash : " + Binary.arrayUint8ToHex(this.hash));

            this.hashValid = true;
        }
        return this.hash;
    }

    public toString(): String {
        return "hash algo : " + this.hashAlgo + " ; pass : " + this.passMaster;
    }

    public equals(other: Credentials): boolean {
        return ((this.getHashAlgo() === other.getHashAlgo()) && (this.getPassMaster() === other.getPassMaster()));
    }
}

export default Credentials;