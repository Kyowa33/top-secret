import React, { useState } from 'react';
import PassPanel from './components/PassPanel.jsx';
import './App.css';
import ImagePanel from './components/ImagePanel.jsx';
import EditableList from './components/EditableList.tsx';
import CarrierFactoryInstance from './service/CarrierFactory.ts';
import Credentials from './model/Credentials.ts';
import 'primeicons/primeicons.css';

import { ProgressBar } from 'primereact/progressbar';
import { DataContainer } from './model/data/DataContainer.ts';
import ItemData from './model/component/ItemData.ts';
import { CarrierManagerBase } from './service/CarrierManagerBase.ts';
import DataConv from './service/DataConv.ts';


let carrierManager: CarrierManagerBase | undefined;

function App() {

  const [fileName, setFileName] = useState<string>("");
  const [credentials, setCredentials] = useState(new Credentials());
  const [status, setStatus] = useState("Open an image file");
  const [progress, setProgress] = useState(0);
  const [progressVisible, setProgressVisible] = useState(false);
  const [listItems, setListItems] = useState<ItemData[]>([]);

  let cbReplaceItems: CallableFunction; // To send listItems into EditableList

  const cbListUpdate = (lst: ItemData[], _cbReplaceItems: CallableFunction) => {
    cbReplaceItems = _cbReplaceItems;
    setListItems(lst); // Receive listItems from EditableList
  }


  const msg = (str) => {
    setStatus(str);
  }


  const onDecodeSuccess = async (data: DataContainer) => {
    msg("Data found : items updated.");

    // keep new items
    let newListItems = listItems.filter((item) => (item.flagNew));

    // add decoded items
    for (const blk of data.getDataBlocks()) {
      await blk.tryDecode("");
      let newItem = DataConv.fromBlockData(blk);
      newListItems.push(newItem);
    }

    // refresh UI
    setListItems(newListItems);
    if (cbReplaceItems !== undefined) {
      cbReplaceItems(newListItems);
    }

  }

  const onDecodeError = (err) => {
    msg("No data found : items not updated (" + err + ").");
  }

  const onAfterDecode = () => {
    setProgressVisible(false);
  }


  const tryDecode = (newCred?) => {
    if ((carrierManager === undefined) || (!carrierManager.isFileRead())) {
      return;
    }
    msg("Decoding...");
    setProgressVisible(true);

    let creds = newCred || credentials;

    console.log("tryDecode " + creds.getPassMaster());
    carrierManager.stop();
    carrierManager = carrierManager.newInstance();

    carrierManager.decode(creds, (_progress) => {
      setProgress(_progress);
    },
      (data: DataContainer) => {
        onDecodeSuccess(data);
        onAfterDecode();
      },
      (error) => {
        onDecodeError(error);
        onAfterDecode();
      }
    );
  }


  const onReadSuccess = () => {
    msg("Image read.");
    tryDecode();
  }

  const onReadError = (err) => {
    msg("Image could not be read (" + err + ").");
  }

  const tryRead = (file) => {

    msg("Reading...");
    setProgressVisible(true);

    console.log("tryRead ");

    if (carrierManager !== undefined) {
      carrierManager.stop();
    }
    carrierManager = CarrierFactoryInstance.getCarrierManager({ type: file.type });

    if (carrierManager === undefined) {
      msg("Image file format not supported.");
      return;
    }

    carrierManager.read(file, (_progress) => {
      setProgress(_progress);
    },
      () => {
        onReadSuccess();
      },
      (error) => {
        onReadError(error);
      }
    );
  }


  const cbImageInputChanged = (file: File) => {
    // alert("Image changed : " + file.name);
    setFileName(file.name);
    // alert(CarrierFactoryInstance.getCarrierManager(file));
    carrierManager = CarrierFactoryInstance.getCarrierManager(file);
    tryRead(file);
  }

  const cbPassMasterChanged = (newCred: Credentials) => {
    if (newCred && (!newCred.equals(credentials))) {
      // alert("new pass : " + newCred.passMaster + "/" + newCred.hash);
      setCredentials(newCred);
    }

    tryDecode(newCred);
  }


  const tryDecodeItem = async (item: ItemData) => {
    let newPass = item.pass;
    for (let i=0; i < listItems.length; i++) {
      let itm = listItems[i];
      if (itm.uid === item.uid) {
        itm.pass = newPass;
      }
      if (!itm.hasDecodedData()) {
        let blk = DataConv.toBlockData(itm);
        await blk.tryDecode(newPass);
        if (blk.isDecoded()) {
          itm = DataConv.fromBlockData(blk);
          itm.pass = newPass;
          listItems[i] = itm;
        }
      }
    }

    if (cbReplaceItems !== undefined) {
      let newItems = [...listItems];
      setListItems(newItems);
      cbReplaceItems(newItems);
    }
  }


  const onWriteSuccess = (blob: Blob) => {
    msg("Image write success.");

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  const onWriteError = (err) => {
    msg("Image write error (" + err + ").");
  }

  const onAfterWrite = () => {
    setProgressVisible(false);
  }


  const startWrite = () => {
    if (carrierManager === undefined) {
      return;
    }

    carrierManager.stop();
    carrierManager = carrierManager.newInstance();

    carrierManager.write((_progress) => {
      setProgress(_progress);
    },
      (blob) => {
        onWriteSuccess(blob);
        onAfterWrite();
      },
      (error) => {
        onWriteError(error);
        onAfterWrite();
      });
  }


  const onEncodeSuccess = () => {
    msg("Items encoded.");
    startWrite();
  }

  const onEncodeError = (err) => {
    msg("Encoding error (" + err + ").");
  }


  const startEncode = async () => {
    
    if (carrierManager === undefined) {
      return;
    }
    
    let dc = new DataContainer();

    if (listItems !== undefined) {
      // Convert back ItemData to BlockData and encode
      for (const item of listItems) {
        if (!item.flagDelete) {
          let newBlk = DataConv.toBlockData(item);
          await newBlk.encode(item.pass);
          dc.addDataBlock(newBlk);
        }
      }
    }

    carrierManager.stop();
    carrierManager = carrierManager.newInstance();

    carrierManager.encode(credentials, dc, (_progress) => {
      setProgress(_progress);
    },
      () => {
        onEncodeSuccess();
      },
      (error) => {
        onEncodeError(error);
      });

  }


  const isCarrier = () => {
    return ((carrierManager !== undefined) && (carrierManager.isFileRead()));
  }


  const handleExport = () => {
    if ((carrierManager === undefined) || (!carrierManager.isFileRead())) {
      return;
    }

    startEncode();
  }

  return (
    <div className="App">
      <header className="App-header">
        <div className='container'>
          <div className='mainAppItem'>
            <ImagePanel callback={cbImageInputChanged} />
          </div>
          <div className='mainAppItem'>
            <PassPanel callback={cbPassMasterChanged} initialCredentials={credentials} />
          </div>
          <div className='card'>
            <span>{status}</span>
            <ProgressBar value={progress} showValue={false} style={{ visibility: (progressVisible ? 'visible' : 'hidden') }}></ProgressBar>
          </div>
          <div className='card mainAppItem'>
            <EditableList listUpdate={cbListUpdate} list={listItems} onTryDecodeItem={tryDecodeItem} />
          </div>
          <div>
            {//credentials !== null && Binary.arrayUint8ToHex(credentials.getHash())
              //listItems.length
            }
          </div>
          <div className='card linePanel'>
            <table align='center'>
              <tbody>
                <tr>
                  <td>
                    <button onClick={handleExport} disabled={!isCarrier()}>

                      <i className={isCarrier() ? "pi pi-spin pi-cog" : "pi pi-cog"} style={{ fontSize: '2rem' }}></i>

                    </button>
                  </td>
                  <td>
                    <button onClick={handleExport} disabled={!isCarrier()}>
                      Process & Download
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
