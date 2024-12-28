import Binary from "../../util/Binary.ts";
import {BlockBase, BlockType} from "./BlockBase.ts";
import {DataContainerParseCode} from "./DataContainer.ts";

class BlockHash extends BlockBase {

    public parseIncData(nextChar: number): DataContainerParseCode {
        if (this.blockDataRaw.length > 32) {
            return DataContainerParseCode.UNEXPECTED_DATA;
        }

        return DataContainerParseCode.OK_CONTINUE;
    }
    
    public newInstance(): BlockBase {
        return new BlockHash();
    }
    
    public getBlockType(): number {
        return BlockType.HASH;
    }

    public computeHash(rawData : Uint8Array) {
        this.blockDataRaw = Binary.computeSHA256(rawData);
    }

    public check(rawData : Uint8Array) : boolean {
        const tmpHash = Binary.computeSHA256(rawData);

        if ((this.blockDataRaw === undefined) || (tmpHash.length !== this.blockDataRaw.length)) {
            return false;
        }

        for (let i=0; i<this.blockDataRaw.length; i++) {
            if (this.blockDataRaw[i] !== tmpHash[i]) {
                return false;
            }
        }

        return true;
    }

}

export default BlockHash;