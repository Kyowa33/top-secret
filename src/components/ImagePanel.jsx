import React, { useState } from 'react';
import { FaFileImage } from 'react-icons/fa';

const ImagePanel = ({ callback }) => {
  const [previewUrl, setPreviewUrl] = useState('');
  const [lastFile, setLastFile] = useState(null);
  const imageMimeType = /image\/(png|jpg|jpeg)/i;

  function callParent(file) {
    if ((file !== undefined) && (file instanceof File)) {
      callback(file);
    } else if (lastFile != null) {
      callback(lastFile);
    }
  }

  function handleImageChange(event) {
    const file = event.target.files[0];
    if (file) {

      if (!file.type.match(imageMimeType)) {
        alert("Image mime type is not valid");
        return;
      }

      setLastFile(file);

      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);

      callParent(file);

    }
  }

  return (
    <div className='card linePanel'>
      <table align='center'>
        <tbody>
          <tr>
            <td>
              <label style={{ cursor: 'pointer' }} title="Click to open an image">
                <FaFileImage style={{ display: "inline" }} />
                <input
                  type="file"
                  id="imageUpload"
                  accept="image/png, image/jpeg"
                  style={{ display: 'none' }}
                  onChange={handleImageChange}
                />
              </label>
            </td>

            {previewUrl && (
              <td>
                <div>
                  {/* <h3>Image Preview:</h3> */}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    title="Click to open an image"
                    onClick={() => document.getElementById('imageUpload').click()}
                    style={{ maxWidth: '600px', maxHeight: '300px', borderRadius: '5px', display: "inline", cursor: "pointer" }}
                  /><br/>
                  {lastFile && (
                    lastFile.name
                  )}
                </div>
              </td>
            )}

            {previewUrl && (
              <td>
                <button onClick={callParent} title='Reload'>
                <i className="pi pi-refresh" style={{ fontSize: '2rem' }}></i>
                </button>
              </td>
            )}

          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ImagePanel;
