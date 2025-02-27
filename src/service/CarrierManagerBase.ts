import Credentials from "../model/Credentials.ts";
import { DataContainer } from "../model/data/DataContainer.ts";
import {Task} from "../util/Task.ts";


enum CarrierManager_Error {
    END_NO_MORE_DATA = "END_NO_MORE_DATA",
    END_NO_SPACE = "END_NO_SPACE",
    END_MISMATCH = "END_MISMATCH",
    END_CORRUPTED = "END_CORRUPTED"
}

abstract class CarrierManagerBase extends Task {

    protected file : File;
    protected fileRead : boolean = false;

    public isFileRead() : boolean {
        return this.fileRead;
    }

    public abstract getAcceptedMimeTypes() : string[];

    public accept(mimeType: String): boolean {
        return this.getAcceptedMimeTypes().filter((v) => mimeType === v).length > 0;
    }
    
    public abstract read(file, onUpdate : CallableFunction, onSuccess : CallableFunction, onError : CallableFunction) : void;
    public abstract decode(creds : Credentials, onUpdate : CallableFunction, onSuccess : CallableFunction, onError : CallableFunction) : void;

    public abstract encode(creds : Credentials, data: DataContainer, onUpdate : CallableFunction, onSuccess : CallableFunction, onError : CallableFunction) : void;
    public abstract write(onUpdate : CallableFunction, onSuccess : CallableFunction, onError : CallableFunction) : Uint8Array | null;
    
    /**
     * Return a number[8] with the capacity (in bits) on each bit layer
     */
    public abstract getLayersCapacity() : number[];

    public abstract newInstance() : CarrierManagerBase;
}

export {CarrierManagerBase, CarrierManager_Error};