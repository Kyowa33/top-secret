

class TabUtils {

    public static isBitSet(arr: any, pos: number, bitW: number) : boolean {
       
        let val = arr[pos];

        if (val === undefined) {
            return false;
        }

        return (val & bitW) !== 0;
    }

    public static setBit(arr: any, pos: number, bitW: number, b : boolean) {

        if (arr[pos] === undefined) {
            return;
        }

        if (b) {
            arr[pos] |= bitW;
        } else {
            arr[pos] &= bitW ^ 0xFF;
        }
    }

    public static getNextFreePos(arr: any, pos: number): number {
        
        let nextPos = pos;

        let idx = nextPos >> 5;
        let bit = nextPos & 0x1F;
        let bitW = 1 << bit;
        let val = arr[idx];
        let wrapped = false;

        if (val === undefined) {
            return -1;
        }

        while ((val & bitW) !== 0) {
            nextPos++;
            bitW <<= 1;
            if ((bitW === 0) || (bitW === (1 << 32))) {
                bitW = 1;
                idx++;
                if (idx >= arr.length) {
                    if (wrapped) {
                        return -1;
                    }
                    idx = 0;
                    nextPos = 0;
                    wrapped = true;
                }
                val = arr[idx];
            }
        }

        arr[idx] |= bitW;

        return nextPos;
    }


    public static test() {
        // let tab: Range[] = [{ from: 2, to: 2 }, { from: 5, to: 6 }, {from: 9, to: 11}];
        // let idxm1 = TabUtils.findDicRange(tab, 0);
        // let idx0b = TabUtils.findDicRange(tab, 3);
        // let idx1 = TabUtils.findDicRange(tab, 4);
        // let idx1b = TabUtils.findDicRange(tab, 5);

        // let nextPos0 = TabUtils.getNextFreePos(tab, 0); // -> 0 + ins from 0 to 0
        // let nextPos3 = TabUtils.getNextFreePos(tab, 1); // -> 1 + merge from 0 to 2
        // let nextPos3b = TabUtils.getNextFreePos(tab, 2); // -> 4 + merge from 0 to 6
        // let nextPos3t = TabUtils.getNextFreePos(tab, 3); // -> 7 + upd from 0 to 7
        // let nextPos7 = TabUtils.getNextFreePos(tab, 4); // -> 8 + merge from 0 to 11
        // let nextPos9 = TabUtils.getNextFreePos(tab, 9); // -> 12 + upd from 0 to 12

        let tab: number[] = [0x80000001, 0x8000F000];
        let nextPos0 = TabUtils.getNextFreePos(tab, 0); // -> 1
        let nextPos1 = TabUtils.getNextFreePos(tab, 31); // -> 32
        let nextPos2 = TabUtils.getNextFreePos(tab, 63); // -> 2
        let s1 = TabUtils.isBitSet(tab, 0, 0x80000000); // true
        let s2 = TabUtils.isBitSet(tab, 0, 0x00000001); // true
        let s3 = TabUtils.isBitSet(tab, 1, 0x00000002); // false
        TabUtils.setBit(tab, 0, 0x00010000, true);
        let s4 = TabUtils.isBitSet(tab, 0, 0x00010000); // true
        TabUtils.setBit(tab, 0, 0x00010000, false);
        let s5 = TabUtils.isBitSet(tab, 0, 0x00010000); // false

        let t2 = new Uint8ClampedArray([0x00,0xFF]);
        let s6 = TabUtils.isBitSet(t2, 1, 0x01); // true
        TabUtils.setBit(t2, 1, 0x01, false);
        let s7 = TabUtils.isBitSet(t2, 1, 0x01); // false
        let stop = 0;

    }
}

export default TabUtils;