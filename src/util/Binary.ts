
import sha256 from 'crypto-js/sha256';

class Binary {

    public static arrayInt32ToUint8(tabIn: number[]): number[] {

        let output: number[] = [];

        let j = 0;

        for (let i = 0; i < tabIn.length; i++) {
            let w32 = tabIn[i];
            output[j++] = (w32 >>> 24) & 0xFF;
            output[j++] = (w32 >>> 16) & 0xFF;
            output[j++] = (w32 >>> 8) & 0xFF;
            output[j++] = w32 & 0xFF;
        }

        return output;
    }

    private static hex : String = "0123456789ABCDEF";

    public static arrayUint8ToHex(tabIn: number[]) : String | undefined {
        let output : String = "";

        for (let i = 0; i < tabIn.length; i++) {
            let value : number = tabIn[i];

            if (value === undefined) {
                return undefined;
            }
            
            let q4 = Binary.hex.at(((value >> 4) & 0x0F));
            output += q4 || "";

            q4 = Binary.hex.at((value & 0x0F));
            output += q4 || "";
        }

        return output;
    }

    public static computeSHA256(buf : Uint8Array) : Uint8Array {
        let tabInt32 = sha256(buf).words;
         return new Uint8Array(Binary.arrayInt32ToUint8(tabInt32));
    }

}

export default Binary;