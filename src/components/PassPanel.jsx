import React, { useState } from 'react';
import { FaKey } from 'react-icons/fa';
import Credentials from '../model/Credentials.ts';
import { Password } from 'primereact/password';

const PassPanel = ({ callback, initialCredentials }) => {
  const [selectedAlgo, setSelectedAlgo] = useState(initialCredentials.hashAlgo || 'SHA-512');
  const [passMaster, setPassMaster] = useState(initialCredentials.passMaster || '');

  const creds = new Credentials(selectedAlgo, passMaster);

  const doSubmit = () => {
    // let creds={hash : selectedAlgo, passMaster : passMaster};
    // alert("submit : " + creds.hash);
    callback(creds);
  }

  const handleSelectChange = (event) => {
    setSelectedAlgo(event.target.value);
    creds.setHashAlgo(event.target.value);
    // alert("handleSelectChange " + event.target.value);
    doSubmit();
  };

  const handlePassMasterChange = (event) => {
    setPassMaster(event.target.value);
    creds.setPassMaster(event.target.value);
    doSubmit();
  };

  return (
    <div className='card linePanel'>
      <table align='center'>
        <tbody>
          <tr>
            <td>
              <FaKey />
            </td>
            <td>
              <select id="hashAlgo" value={selectedAlgo} onChange={handleSelectChange}>
                <option value="SHA-256">SHA-256</option>
                <option value="SHA-512">SHA-512</option>
              </select>
            </td>
            <td>
              <Password inputId="passMaster" value={passMaster} onChange={handlePassMasterChange}
                toggleMask feedback="false" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default PassPanel;
