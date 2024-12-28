import {CarrierManagerBase} from './CarrierManagerBase.ts';
import CarrierManagerPNG from './CarrierManagerPNG.ts';

class CarrierFactory {


    private tabCarrierManager: Array<CarrierManagerBase> = [new CarrierManagerPNG()];

    private static instance: CarrierFactory;


    constructor() {
        if (!CarrierFactory.instance) {
            CarrierFactory.instance = this;
        }
        return CarrierFactory.instance;
    }

    public getCarrierManager(file) : CarrierManagerBase | undefined {
        if ((file === null) || (file.type === null))
            return undefined;

        const mimeType = file.type;

        let res = this.tabCarrierManager.find((value) => (value.accept(mimeType)));
        if (res === undefined) {
            return res;
        }
        
        return res.newInstance();
    }

}

const CarrierFactoryInstance = new CarrierFactory();
Object.freeze(CarrierFactoryInstance);

export default CarrierFactoryInstance;