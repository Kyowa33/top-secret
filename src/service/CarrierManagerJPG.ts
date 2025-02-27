import { CarrierManager_Error, CarrierManagerBase } from "./CarrierManagerBase.ts";
import Credentials from "../model/Credentials.ts";
import { Task, TaskState } from "../util/Task.ts";
import { DataContainer, DataContainerParseCode } from "../model/data/DataContainer.ts";
import JpgDecodeJpgBufferToFrame from "./jpg_dec.js";
import { JpgEncodePixelsToJpgBuffer, JpgEncodeFrameToJpgBuffer } from "./jpg_enc.js";



enum StatusEncoder {
    ENCODE_BLOCKS = 0,
    PRINT_DATA_CONTAINER,
    PRINTING_DATA_CONTAINER,
    ENCODE_IMAGE,
}

class StateObject extends TaskState {

    // Encoding-specific status
    public encodeStatus: StatusEncoder;
    public encodedOutBuffer: Uint8Array;
    public byteIndex = 0;

    // Image path driver
    public hash: number[];
    public hashIndex = 0;

    // Image data indexes
    public pos = 0;
    public bitLayer = 1; // 1 << track
    private capacityMap: number[];

    // Byte reconstruction
    public curByte = 0;
    public curByteBitW = 1;

    // Data block container
    public data: DataContainer;

    // Global bit counter
    public bitCounter = 0;
    public bitTotal = 0;


    public computeBitTotal(capLay: number[]) {
        this.bitTotal = 0;
        for (let i = 0; i < 8; i++) {
            this.bitTotal += capLay[i];
        }
    }

    public setCapacityMap(capMap: number[]) {
        this.capacityMap = capMap.slice(0); // clone array.
    }

    public resetPos() {
        this.hashIndex %= this.hash.length;
        let h1 = this.hash[this.hashIndex++];
        this.hashIndex %= this.hash.length;
        let h2 = this.hash[this.hashIndex++];
        this.hashIndex %= this.hash.length;
        let h3 = this.hash[this.hashIndex++];

        this.pos = h1 + (h2 << 8) + (h3 << 16);
        this.pos %= this.capacityMap.length;
        // console.log("### resetPos: " + this.pos + " ; hashIndex : " + this.hashIndex);

        // let _p = 0;
        // let nbBits = 0;
        // while (_p < this.capacityMap.length) {
        //     if ((this.capacityMap[_p] & this.bitLayer) !== 0) {
        //         nbBits++;
        //     }
        //     _p++;
        // }
        // console.log("NbBits on layer " + this.bitLayer + " : " + nbBits);
    }

    private moveToNextFreePos() {
        let startPos = this.pos;
        while ((this.pos < this.capacityMap.length) && ((this.capacityMap[this.pos] & this.bitLayer) === 0)) {
            this.pos++;
        }
        if (this.pos >= this.capacityMap.length) {
            // Retry from pos 0
            this.pos = 0;
            while ((this.pos < startPos) && ((this.capacityMap[this.pos] & this.bitLayer) === 0)) {
                this.pos++;
            }
            if (this.pos === startPos) {
                // One complete turn
                this.pos = this.capacityMap.length;
            }
        }
        // console.log("### moveToNextFreePos: returns " + this.pos + " : capMap : " + this.capacityMap[this.pos]);
    }

    public incPos(): boolean {
        this.hashIndex %= this.hash.length;
        this.pos += this.hash[this.hashIndex++];
        this.pos %= this.capacityMap.length;

        this.moveToNextFreePos();

        // console.log("incPos: " + this.pos + " ; hashIndex : " + this.hashIndex);

        while (this.pos >= this.capacityMap.length) {
            // console.log("Layer " + this.bitLayer + " full");
            this.bitLayer <<= 1;
            if (this.bitLayer === 256) {
                // console.log("All layers full. Exiting.");
                return false;
            }
            this.resetPos();
            this.moveToNextFreePos();
        }

        // Mark the position as used : clear bit
        this.capacityMap[this.pos] &= (this.bitLayer ^ 0xFF);
        // console.log("Mark pos " + this.pos + " : capMap : " + this.capacityMap[this.pos]);

        return true;
    }
}


class CarrierManagerJPG extends CarrierManagerBase {

    private imageJpg;
    private blockMap: number[][]; // linear buffer DCT coefs : [blockIndex][0..63]
    private capacityLayer: number[];
    private capacityMap: number[]; // linear buffer DCT exploitable bits : [blockMap.length*64] ; bit set --> exploitable bit

    constructor() {
        super();
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; constructor");
    }

    public newInstance(): CarrierManagerBase {
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; newInstance");
        const newInst = new CarrierManagerJPG();
        newInst.file = this.file;
        newInst.imageJpg = this.imageJpg;
        newInst.fileRead = this.fileRead;
        newInst.blockMap = this.blockMap;
        newInst.capacityLayer = this.capacityLayer;
        newInst.capacityMap = this.capacityMap;
        return newInst;
    }

    public getAcceptedMimeTypes(): string[] {
        return ["image/jpeg", "image/jpg"];
    }


    private buildBlockMap() {
        console.log("Extracting DCT block map");
        let frame = this.imageJpg.frame;
        let c, x, y;
        this.blockMap = [];
        for (var compId in frame.componentsOrder) {
            c = frame.components[frame.componentsOrder[compId]];
            console.log("Component index " + frame.componentsOrder[compId] + ", compId " + compId + " : H" + c.h + " ; V" + c.v);
            for (y = 0; y < c.blocks.length; y++) {
                for (x = 0; x < c.blocks[y].length; x++) {
                    this.blockMap.push(c.blocks[y][x]);
                }
            }
        }
        console.log("DCT block map extracted : " + this.blockMap.length + " 8x8 DCT blocks");
    }

    private async jpegBufferToImageData(buffer) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (ctx === null) {
                reject(new Error("no 2D context"));
                return;
            }

            const url = URL.createObjectURL(new Blob([buffer], { type: 'image/jpeg' }));
            img.src = url;

            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const imageBitmapRGBA = ctx.getImageData(0, 0, img.width, img.height);

                // Clean up
                URL.revokeObjectURL(url);
                resolve(imageBitmapRGBA);
            };

            img.onerror = function (error) {
                URL.revokeObjectURL(url);
                reject(error);
            };
        });
    }

    private async loadFromPixels(buf) {
        // Extract jpg with a standard Image & canvas
        let imgData = await this.jpegBufferToImageData(buf);

        // Encode pixels to jpg format
        let data = JpgEncodePixelsToJpgBuffer(imgData, 50);

        // Extract back jpg to frame
        let imgDec = JpgDecodeJpgBufferToFrame(data);
        return imgDec;
    }


    public read(file: any, onUpdate: CallableFunction, onSuccess: CallableFunction, onError: CallableFunction): void {
        this.file = file;
        this.imageJpg = null;

        if (Task.LOG) {
            let currentTimeStart = Date.now();
            console.log("inst " + this.taskInstanceNumber + " ; call read : " + currentTimeStart);
        }
        this.stop();
        this.start(new StateObject(() => { this.runRead() }, onUpdate, onSuccess, onError));
        onUpdate(0);
    }


    private runRead(): boolean {

        const incObj: StateObject = this.getIncObj() as StateObject;

        if (Task.LOG) {
            let currentTimeStart = Date.now();
            console.log("inst " + this.taskInstanceNumber + " ; call runRead : " + currentTimeStart);
        }

        const reader = new FileReader();

        reader.onload = async () => {
            try {
                this.imageJpg = JpgDecodeJpgBufferToFrame(reader.result);
            }
            catch (err) {
                // Unsupported Jpg version : Rewrite the Jpg from pixels.
                try {
                    console.log("JPEG format not supported. Rebuilding from pixels via a standard Canvas.");
                    this.imageJpg = await this.loadFromPixels(reader.result);
                    console.log("Rebuilt from pixels.");
                }
                catch (err2) {
                    console.log("JPEG re-encoding error.");
                    this.stop();
                    incObj.onError(err2.message);
                }
            }

            this.fileRead = true;
            this.buildBlockMap();
            this.getLayersCapacity(); // Init maps

            this.stop();
            incObj.onSuccess();
        }

        reader.readAsArrayBuffer(this.file);
        this.stop();

        return false;
    }


    public decode(creds: Credentials, onUpdate: CallableFunction, onSuccess: CallableFunction, onError: CallableFunction): void {
        if (Task.LOG) {
            let currentTimeStart = Date.now();
            console.log("inst " + this.taskInstanceNumber + " ; call decode : " + currentTimeStart);
        }
        this.stop();
        const newIncObj: StateObject = new StateObject(() => { this.runDecode() }, onUpdate, onSuccess, onError);
        newIncObj.data = new DataContainer();
        newIncObj.hash = creds.getHash();
        newIncObj.setCapacityMap(this.capacityMap);
        newIncObj.computeBitTotal(this.capacityLayer);
        newIncObj.resetPos();
        this.start(newIncObj);
        onUpdate(0);
    }

    public runDecode(): boolean {

        const incObj: StateObject = this.getIncObj() as StateObject;

        if (Task.LOG) {
            let currentTimeStart = Date.now();
            console.log("inst " + this.taskInstanceNumber + " ; call runDecode : " + currentTimeStart);
        }

        let runCount = 0;

        // Parse 1kB
        while (runCount < 8 * 1024) {
            incObj.bitCounter++;
            runCount++;

            if (!incObj.incPos()) {
                this.stop();
                incObj.onError(CarrierManager_Error.END_NO_MORE_DATA);
                break;
            }

            let posBlock = incObj.pos >> 6;
            let posDct = incObj.pos & 63;

            if ((this.blockMap[posBlock][posDct] & incObj.bitLayer) !== 0) {
                incObj.curByte |= incObj.curByteBitW;
            }

            // if (incObj.byteIndex === 194400) {
            // if (incObj.pos === 122326) {
            //     console.log("decode : incObj.bitCounter = " + incObj.bitCounter + " ; pos = " + incObj.pos + " ; bitW = " + incObj.curByteBitW + " ; bitLayer = " + incObj.bitLayer + " ; (incObj.curByte & incObj.curByteBitW) = " + (incObj.curByte & incObj.curByteBitW));
            // }

            incObj.curByteBitW <<= 1;
            if (incObj.curByteBitW > 128) {
                let parseRet = incObj.data.parseInc(incObj.curByte);
                if (parseRet === DataContainerParseCode.OK_END) {
                    this.stop();
                    incObj.onSuccess(incObj.data);
                    break;
                }
                if ((parseRet === DataContainerParseCode.UNEXPECTED_END)) {
                    this.stop();
                    incObj.onError(CarrierManager_Error.END_NO_MORE_DATA);
                    break;
                }

                if ((parseRet === DataContainerParseCode.UNEXPECTED_DATA)) {
                    this.stop();
                    incObj.onError(CarrierManager_Error.END_MISMATCH);
                    break;
                }

                if ((parseRet === DataContainerParseCode.HASH_MISMATCH)) {
                    this.stop();
                    incObj.onError(CarrierManager_Error.END_CORRUPTED);
                    break;
                }
                incObj.curByteBitW = 1;
                incObj.curByte = 0;
                incObj.byteIndex++;
            }
        }

        incObj.onUpdate(incObj.bitCounter * 100 / incObj.bitTotal);
        return false;
    }



    public encode(creds: Credentials, data: DataContainer, onUpdate: CallableFunction, onSuccess: CallableFunction, onError: CallableFunction): void {
        if (Task.LOG) {
            let currentTimeStart = Date.now();
            console.log("inst " + this.taskInstanceNumber + " ; call encode : " + currentTimeStart);
        }
        this.stop();
        const newIncObj: StateObject = new StateObject(() => { this.runEncode() }, onUpdate, onSuccess, onError);
        newIncObj.data = data;
        newIncObj.encodeStatus = StatusEncoder.PRINT_DATA_CONTAINER;
        newIncObj.byteIndex = 0;
        newIncObj.hash = creds.getHash();
        newIncObj.setCapacityMap(this.capacityMap);
        newIncObj.computeBitTotal(this.capacityLayer);
        newIncObj.resetPos();
        this.start(newIncObj);
        onUpdate(0);
    }


    public async runEncode() {

        const incObj: StateObject = this.getIncObj() as StateObject;

        if (Task.LOG) {
            let currentTimeStart = Date.now();
            console.log("inst " + this.taskInstanceNumber + " ; call runEncode : " + currentTimeStart);
        }

        if (incObj.encodeStatus === StatusEncoder.PRINT_DATA_CONTAINER) {
            incObj.encodeStatus = StatusEncoder.PRINTING_DATA_CONTAINER;
            incObj.encodedOutBuffer = await incObj.data.printOut();
            // runEncode can be called again by the Task loop while data.printOut works.
            incObj.byteIndex = 0;
            incObj.curByte = incObj.encodedOutBuffer[incObj.byteIndex];
            incObj.curByteBitW = 1;
            incObj.encodeStatus = StatusEncoder.ENCODE_IMAGE;
            return true; // Break the Task loop
        }

        if (incObj.encodeStatus === StatusEncoder.PRINTING_DATA_CONTAINER) {
            return true; // Break the Task loop
        }

        if (incObj.encodeStatus === StatusEncoder.ENCODE_IMAGE) {
            let runCount = 0;

            // Encode 1kB
            while (runCount < 1024) {
                incObj.bitCounter++;
                runCount++;

                if (!incObj.incPos()) {
                    this.stop();
                    incObj.onError(CarrierManager_Error.END_NO_SPACE);
                    break;
                }

                let posBlock = incObj.pos >> 6;
                let posDct = incObj.pos & 63;

                if ((incObj.curByte & incObj.curByteBitW) !== 0) {
                    this.blockMap[posBlock][posDct] |= incObj.bitLayer;
                } else {
                    this.blockMap[posBlock][posDct] &= (incObj.bitLayer ^ (-1));
                }

                incObj.curByteBitW <<= 1;
                if (incObj.curByteBitW > 128) {
                    incObj.byteIndex++;
                    if (incObj.byteIndex >= incObj.encodedOutBuffer.length) {
                        console.log("Last BitLayer used : " + incObj.bitLayer);
                        this.stop();
                        incObj.onSuccess();
                        break;
                    }
                    incObj.curByte = incObj.encodedOutBuffer[incObj.byteIndex];
                    incObj.curByteBitW = 1;
                }
            }
            incObj.onUpdate(incObj.byteIndex * 100 / incObj.encodedOutBuffer.length);
        }

        return false; // Continue the task loop until the timeframe is completely spent.
    }


    public write(onUpdate: CallableFunction, onSuccess: CallableFunction, onError: CallableFunction): Uint8Array | null {
        if (Task.LOG) {
            let currentTimeStart = Date.now();
            console.log("inst " + this.taskInstanceNumber + " ; call write : " + currentTimeStart);
        }
        // No background task here.
        this.stop();

        try {
            let outBuf = JpgEncodeFrameToJpgBuffer(this.imageJpg);
            onSuccess(new Blob([outBuf]));
        }
        catch (err) {
            onError(err.message);
        }
        return null;
    }


    /**
     * Discrete Cosine Transform (DCT) coefs are -128 .. +127
     * 
     * Exploitable bits : x
     * 
     * Positive values
     * 00000000 :  0      : Not exploitable bit 0 : zeroes are not encoded, so multiple changes to 1 would increase a lot the jpg file size.
     * Zeroes are a trailing value and a non-zero value after a zero would be a red alert for a steganography detector.
     * 00000001 :  1      : Not exploitable bit 0 : a change to zero would eliminate this slot from the codec scope

     * 0000001x :   2..3    : Exploitable bit  0      : variation 0..1
     * 000001xx :   4..7    : Exploitable bits 0 to 1 : variation 0..3
     * 00001xxx :   8..15   : Exploitable bits 0 to 2 : variation 0..7
     * 0001xxxx :  16..31   : Exploitable bits 0 to 3 : variation 0..15
     * 001xxxxx :  32..63   : Exploitable bits 0 to 4 : variation 0..31
     * 01xxxxxx :  64..127  : Exploitable bits 0 to 5 : variation 0..63
     * 
     * Negative values :
     * 1111111x :  -1..-2   : Exploitable bit  0      : variation 0..1
     * 1111110x :  -3..-4   : Exploitable bit  0      : variation 0..1
     * 111110xx :  -5..-8   : Exploitable bits 0 to 1 : variation 0..3
     * 11110xxx :  -9..-16  : Exploitable bits 0 to 2 : variation 0..7
     * 1110xxxx : -17..-32  : Exploitable bits 0 to 3 : variation 0..15
     * 110xxxxx : -33..-64  : Exploitable bits 0 to 4 : variation 0..31
     * 10xxxxxx : -65..-128 : Exploitable bits 0 to 5 : variation 0..63
     * 
     * @returns 
     */
    public getLayersCapacity(): number[] {
        let caps: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
        let bitLayer: number;
        let i: number;
        let ind: number;
        let v: number;
        let cm: number = 0;

        if (this.capacityLayer === undefined) {
            this.capacityMap = [];
            for (i = 0; i < this.blockMap.length; i++) {
                for (ind = 0; ind < 64; ind++, cm++) {
                    this.capacityMap[cm] = 0;
                    v = this.blockMap[i][ind];

                    if ((v === 0) || (v === 1)) {
                        // Not exploitable bit.
                        continue;
                    }

                    if (v > 0) {
                        // Positive values : find the higher set bit except bit 7 (128)
                        bitLayer = 6;
                        while ((v & (1 << bitLayer)) === 0) {
                            bitLayer--;
                        }
                        bitLayer--; // Skip bit 1
                        while (bitLayer >= 0) {
                            this.capacityMap[cm] |= (1 << bitLayer);
                            caps[bitLayer]++;
                            bitLayer--;
                        }
                    } else
                        if (v >= -2) {
                            // Values -1 and -2 are exceptions
                            this.capacityMap[cm] |= 1;
                            caps[0]++;
                        } else {
                            // Negative values : find the higher clear bit except bit 7 (128)
                            bitLayer = 6;
                            while ((v & (1 << bitLayer)) > 0) {
                                bitLayer--;
                            }
                            bitLayer--; // Skip bit 0

                            // Values -1 and -2 are exceptions
                            // if (bitLayer > 0)
                            //     bitLayer--; // Skip bit 0
                            // else 
                            //     bitLayer = 0; // Exception for -1 and -2 values

                            while (bitLayer >= 0) {
                                this.capacityMap[cm] |= (1 << bitLayer);
                                caps[bitLayer]++;
                                bitLayer--;
                            }
                        }
                }
            }

            for (let i = 0; i < 8; i++) {
                console.log("DCT exploitable capacity : Bit " + i + " -> " + caps[i] + " bits");
            }

            // // Debug
            // bitLayer = 1;
            // while (bitLayer < 256) {
            //     let _p = 0;
            //     let nbBits = 0;
            //     while (_p < this.capacityMap.length) {
            //         if ((this.capacityMap[_p] & bitLayer) !== 0) {
            //             nbBits++;
            //         }
            //         _p++;
            //     }
            //     console.log("NbBits on layer " + bitLayer + " : " + nbBits);
            //     bitLayer <<= 1;
            // }

            this.capacityLayer = caps;
        }

        return this.capacityLayer;
    }

}



export default CarrierManagerJPG;