import { CarrierManager_Error, CarrierManagerBase } from "./CarrierManagerBase.ts";
import Credentials from "../model/Credentials.ts";
import { Task, TaskState } from "../util/Task.ts";
import { DataContainer, DataContainerParseCode } from "../model/data/DataContainer.ts";
import TabUtils from "../util/TabUtils.ts";
import UPNG from "upng";

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
    public bitMap;

    // Byte reconstruction
    public curByte = 0;
    public curByteBitW = 1;

    // Data block container
    public data: DataContainer;

    // Global bit counter
    public bitCounter = 0;
    public bitTotal = 0;
    public bitsOnLayer = 0;

    public resetPos() {
        this.hashIndex %= this.hash.length;
        let h1 = this.hash[this.hashIndex++];
        this.hashIndex %= this.hash.length;
        let h2 = this.hash[this.hashIndex++];
        this.hashIndex %= this.hash.length;
        let h3 = this.hash[this.hashIndex++];

        this.pos = h1 + (h2 << 8) + (h3 << 16);
        this.pos %= this.bitsOnLayer;
        this.bitMap = new Uint32Array(this.bitsOnLayer / 32); // 32-bits words for 1 layer
        console.log("### resetPos: " + this.pos + " ; hashIndex : " + this.hashIndex);
    }

    public incPos(): boolean {
        this.hashIndex %= this.hash.length;
        this.pos += this.hash[this.hashIndex++];
        this.pos %= this.bitsOnLayer;
        this.pos = TabUtils.getNextFreePos(this.bitMap, this.pos);

        //console.log("incPos: " + this.pos + " ; hashIndex : " + this.hashIndex);

        if (this.pos < 0) {
            console.log("Layer " + this.bitLayer + " full");
            this.bitLayer <<= 1;
            if (this.bitLayer === 256) {
                return false;
            }
            this.resetPos();
        }
        return true;
    }
}

enum CarrierManagerPNG_Error {
    CTX_NULL = "CTX_NULL",
}

class CarrierManagerPNG extends CarrierManagerBase {

    private imageData: ImageData;

    constructor() {
        super();
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; constructor");
    }

    public newInstance(): CarrierManagerBase {
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; newInstance");
        const newInst = new CarrierManagerPNG();
        newInst.file = this.file;
        newInst.imageData = this.imageData;
        newInst.fileRead = this.fileRead;
        return newInst;
    }

    public accept(mimeType: String): boolean {
        return mimeType === "image/png";
    }

    /**
     * 
     * @param imageData ImageData
     * @param onUpdate 
     * @param onSuccess 
     * @param onError 
     */
    public read(file, onUpdate: CallableFunction, onSuccess: CallableFunction, onError: CallableFunction): void {
        this.file = file;
        if (Task.LOG) {
            let currentTimeStart = Date.now();
            console.log("inst " + this.taskInstanceNumber + " ; call read : " + currentTimeStart);
        }
        this.stop();
        this.start(new StateObject(() => { this.runRead() }, onUpdate, onSuccess, onError));
        onUpdate(0);
    }


    public decode(creds: Credentials, onUpdate: CallableFunction, onSuccess: CallableFunction, onError: CallableFunction): void {
        if (Task.LOG) {
            let currentTimeStart = Date.now();
            console.log("inst " + this.taskInstanceNumber + " ; call decode : " + currentTimeStart + " ; " + creds.getPassMaster());
        }
        this.stop();
        const newIncObj: StateObject = new StateObject(() => { this.runDecode() }, onUpdate, onSuccess, onError);
        newIncObj.data = new DataContainer();
        newIncObj.hash = creds.getHash();
        newIncObj.bitsOnLayer = this.imageData.width * this.imageData.height * 4 // ARGB;
        newIncObj.bitTotal = newIncObj.bitsOnLayer * 8; // 8-bits per channel
        newIncObj.resetPos();
        this.start(newIncObj);
        onUpdate(0);
    }


    public runRead(): boolean {

        const incObj: StateObject = this.getIncObj() as StateObject;

        if (Task.LOG) {
            let currentTimeStart = Date.now();
            console.log("inst " + this.taskInstanceNumber + " ; call runRead : " + currentTimeStart);
        }

        const reader = new FileReader();

        reader.onload = () => {
            let img = UPNG.decode(reader.result);
            this.imageData = { data: UPNG.toRGBA8(img), width: img.width, height: img.height, colorSpace: 'srgb' };
            this.fileRead = true;
            this.stop();
            incObj.onSuccess();
        }

        reader.readAsArrayBuffer(this.file);
        this.stop();

        return false;
    }


    public runDecode(): boolean {

        const incObj: StateObject = this.getIncObj() as StateObject;
        const imgData = this.imageData.data;

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

            if (TabUtils.isBitSet(imgData, incObj.pos, incObj.bitLayer)) {
                incObj.curByte |= incObj.curByteBitW;
            }

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
            console.log("inst " + this.taskInstanceNumber + " ; call encode : " + currentTimeStart + " ; " + creds.getPassMaster());
        }
        this.stop();
        const newIncObj: StateObject = new StateObject(() => { this.runEncode() }, onUpdate, onSuccess, onError);
        newIncObj.data = data;
        newIncObj.encodeStatus = StatusEncoder.PRINT_DATA_CONTAINER;
        newIncObj.byteIndex = 0;
        newIncObj.hash = creds.getHash();
        newIncObj.bitsOnLayer = this.imageData.width * this.imageData.height * 4 // ARGB;
        newIncObj.bitTotal = newIncObj.bitsOnLayer * 8; // 8-bits per channel
        newIncObj.resetPos();
        this.start(newIncObj);
        onUpdate(0);
    }


    public write(onUpdate: CallableFunction, onSuccess: CallableFunction, onError: CallableFunction): Uint8Array | null {

        if (Task.LOG) {
            let currentTimeStart = Date.now();
            console.log("inst " + this.taskInstanceNumber + " ; call write : " + currentTimeStart);
        }
        // No background task here.
        this.stop();

        try {
            let outBuf = UPNG.encode(this.imageData.data, this.imageData.width, this.imageData.height, 0);
            onSuccess(new Blob([outBuf]));
        }
        catch (err) {
            onError(err);
        }

        return null;
    }


    public async runEncode() {

        const incObj: StateObject = this.getIncObj() as StateObject;
        const imgData = this.imageData.data;

        if (Task.LOG) {
            let currentTimeStart = Date.now();
            console.log("inst " + this.taskInstanceNumber + " ; call runEncode : " + currentTimeStart);
        }

        if (incObj.encodeStatus === StatusEncoder.PRINT_DATA_CONTAINER) {
            incObj.encodeStatus = StatusEncoder.PRINTING_DATA_CONTAINER;
            incObj.encodedOutBuffer = await incObj.data.printOut();
            // runEncode can be called again by the Task loop while data.printOut works.
            incObj.encodeStatus = StatusEncoder.ENCODE_IMAGE;
            incObj.byteIndex = 0;
            incObj.curByte = incObj.encodedOutBuffer[incObj.byteIndex];
            incObj.curByteBitW = 1;
            return true;
        } else 
        if (incObj.encodeStatus === StatusEncoder.ENCODE_IMAGE) {
            let runCount = 0;

            // Parse 1kB
            while (runCount < 8 * 1024) {
                incObj.bitCounter++;
                runCount++;

                if (!incObj.incPos()) {
                    this.stop();
                    incObj.onError(CarrierManager_Error.END_NO_SPACE);
                    break;
                }

                TabUtils.setBit(imgData, incObj.pos, incObj.bitLayer, (incObj.curByte & incObj.curByteBitW) !== 0);

                incObj.curByteBitW <<= 1;
                if (incObj.curByteBitW > 128) {
                    incObj.byteIndex++;
                    if (incObj.byteIndex >= incObj.encodedOutBuffer.length) {
                        this.stop();
                        incObj.onSuccess();
                        break;
                    }
                    incObj.curByte = incObj.encodedOutBuffer[incObj.byteIndex];
                    incObj.curByteBitW = 1;
                }
            }
        }

        incObj.onUpdate(incObj.bitCounter * 100 / incObj.bitTotal);

        return false;
    }

}

export default CarrierManagerPNG;