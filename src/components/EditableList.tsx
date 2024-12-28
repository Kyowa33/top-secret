import React, { useState } from 'react';
import { FaUpload, FaDownload, FaEye, FaTrash, FaTrashRestore, FaCheck, FaLock, FaLockOpen, FaEdit, FaPlusCircle, FaTimes, FaStar } from 'react-icons/fa';
import { Password } from 'primereact/password';
import ItemData from '../model/component/ItemData.ts';

let nbTrashItems = 0;

const EditableList = ({ listUpdate, list, onTryDecodeItem }) => {
  const [items, setItems] = useState<ItemData[]>(list);
  const [editableIndex, setEditableIndex] = useState(null);
  const [editingContentIndex, setEditingContentIndex] = useState(null);
  const [textEditorValue, setTextEditorValue] = useState<string>("");


  const replaceItems = (newItems: ItemData[]) => {
    setItems(newItems);
  }

  const updateItems = (newItems: ItemData[]) => {
    setItems(newItems);
    listUpdate(newItems, replaceItems);
  }

  listUpdate(items, replaceItems);


  const handleNameClick = (index) => {
    setEditableIndex(index);
  };

  const handleNameChange = (index, value) => {
    let newItems = [...items];
    newItems[index].name = value;
    newItems[index].flagNameEdited = true;
    setItems(newItems);
    updateItems(newItems);
  };

  const handleNameBlur = () => {
    setEditableIndex(null);
  };

  const handleAddItem = () => {
    let newItem = new ItemData();
    let newItems = [...items, newItem];
    updateItems(newItems);
  };

  const handleDeleteItem = (index) => {
    const item = items[index];

    item.flagDelete = !item.flagDelete;
    nbTrashItems += item.flagDelete ? 1 : -1;
    let newItems = [...items];
    updateItems(newItems);
  };

  const handleEmptyTrash = () => {
    let lstItemsToDelete = items.filter((it) => it.flagDelete === true);
    if (lstItemsToDelete.length > 0) {
      let confirmDelete = window.confirm("Are you sure you want to permanently delete these " + lstItemsToDelete.length + " item(s)?");

      if (confirmDelete) {
        let lstUids = lstItemsToDelete.map((it) => it.uid);
        updateItems(items.filter((it) => !lstUids.includes(it.uid)));
        nbTrashItems = 0;
      }
      setEditingContentIndex(null);
    }
  };

  const handleUpload = (index, event) => {
    const item = items[index];
    if (item.isText()) {
      const confirmOverride = window.confirm("Uploading a new file will delete the existing note. Continue?");
      if (!confirmOverride) return;
    }

    const file: File = event.target.files[0];
    if (file) {
      const newItems = [...items];
      const item = newItems[index];

      item.name = file.name;
      item.contentType = file.type;
      const reader = new FileReader();

      reader.onload = function (e) {
        const arrayBuffer = e.target?.result;
        const uint8Array = new Uint8Array(arrayBuffer as ArrayBufferLike);
        item.decodedData = uint8Array;
        updateItems(newItems);
      };

      reader.readAsArrayBuffer(file);
    }
  };

  const handleDownload = (item) => {
    if (item.hasDecodedData()) {
      const blob = new Blob([item.decodedData], { type: item.contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      alert('No file or content to download.');
    }
  };

  const handlePreview = (item) => {

    if (item.decodedData !== null) {
      const blob = new Blob([item.decodedData], { type: item.contentType });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      URL.revokeObjectURL(url);
    } else {
      alert('No content to preview.');
    }
  };

  const handleEditContent = (index) => {
    const item = items[index];

    if (!item.isContentEditable()) {
      return;
    }

    if (item.decodedData !== null) {
      let decoder = new TextDecoder();
      let s = decoder.decode(item.decodedData);
      setTextEditorValue(s);
    } else {
      setTextEditorValue("");
    }
    setEditingContentIndex(index);
  };

  const handleSaveContent = () => {
    if (editingContentIndex === null) return;
    const item = items[editingContentIndex];

    const encoder = new TextEncoder();
    item.decodedData = encoder.encode(textEditorValue);

    item.contentType = 'text/plain';
    setEditingContentIndex(null);
    setTextEditorValue('');
    updateItems(items);
  };

  const formatFileSize = (size) => {
    if (size < 1024) {
      return `${size}\xA0bytes`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(2)}\xA0KB`;
    } else {
      return `${(size / (1024 * 1024)).toFixed(2)}\xA0MB`;
    }
  };

  const getItemLabel = (item) => {
    let displaySize = !item.isDecoded() || !item.isText();
    let hasContent = item.isContentEditable();

    if (!displaySize && !hasContent)
      return 'No content';

    if (displaySize) {
      let size = 0;
      if (item.hasEncodedData()) {
        size = item.encodedData.length || item.decodedData.size;
      }
      if (item.hasDecodedData()) {
        size = item.decodedData.length || item.decodedData.size;
      }
      return formatFileSize(size);
    }

    if (item.decodedData === null) {
      return "";
    }

    let decoder = new TextDecoder();
    let s = decoder.decode(item.decodedData);

    if (s.length > 10) {
      return s.substring(0, 10) + "...";
    }

    return s;
  }

  const handlePassChange = async (index, value) => {
    const item = items[index];
    item.pass = value;

    if (!item.hasDecodedData()) {
      await onTryDecodeItem(item);
    } else {
      const newItems = [...items];
      setItems(newItems);
    }

  }



  return (
    <div style={{ paddingTop: "1rem" }}>
      {/* <h3><FaArrowDown/><FaArrowDown/><FaArrowDown/></h3> */}
      <button onClick={handleAddItem} style={{ marginBottom: '10px' }} title="Add new item">
        <FaPlusCircle />
      </button>
      <table style={{ border: 'none', padding: 0, width: '100%' }}>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} style={{ width: '100%', alignItems: 'center', marginBottom: '10px' }} className={(item.flagDelete === true) ? 'trTrash' : 'trNorm'}>
              <td className={item.flagNew ? 'itemNew' : 'itemExisting'} style={{ flex: 1, marginRight: '10px' }}>
                <FaStar title={item.flagNew ? "New item" : "Existing item"} />
              </td>
              <td className={!item.isDecoded() ? 'itemEncrypted' : 'itemDecrypted'} style={{ flex: 1, marginRight: '10px' }}>
                {(!item.isDecoded()) ? <FaLock title="Encrypted" /> : <FaLockOpen title="Decrypted" />}
              </td>
              <td >
                {(editableIndex === index) && (item.isDecoded()) ? (
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                    onBlur={handleNameBlur}
                    autoFocus
                  />
                ) : (item.isDecoded()) ? (
                  <span
                    onClick={() => handleNameClick(index)}
                    style={{ cursor: 'pointer', textDecoration: 'underline', verticalAlign: 'middle' }}
                  >
                    {item.name}
                  </span>
                ) : (
                  <span
                    className='encryptedName'
                  >
                    Encrypted
                  </span>
                )
                }
              </td>
              <td style={{ color: 'grey' }}>
                {getItemLabel(item)}
              </td>
              <td style={{ alignContent: 'center' }}>
                <div>
                  <div style={{ display: 'inline-flex', gap: '10px', verticalAlign: 'middle' }}>
                    <button style={{ cursor: 'pointer' }} disabled={!item.isDecoded()}
                      onClick={() => document.getElementById("itemUpload" + index)?.click()}
                      title="Attach file">
                      <FaUpload />
                      <input id={"itemUpload" + index}
                        type="file"
                        style={{ display: 'none' }}
                        onChange={(event) => handleUpload(index, event)}
                      />
                    </button>
                    <button onClick={() => handleDownload(item)} title="Download" disabled={!item.hasDecodedData()}>
                      <FaDownload />
                    </button>
                    <button onClick={() => handlePreview(item)} title="Preview" disabled={!item.isPreviewable()}>
                      <FaEye />
                    </button>

                    <button onClick={() => handleEditContent(index)} title="Edit Content" disabled={!item.isContentEditable()}>
                      <FaEdit />
                    </button>
                    <div style={{}}>
                      <Password value={item.pass} onChange={(e) => handlePassChange(index, e.target.value)} toggleMask feedback={false} />
                    </div>
                    {item.flagDelete ? (
                      <button onClick={() => handleDeleteItem(index)} title="Restore">
                        <FaTrashRestore />
                      </button>
                    ) : (
                      <button onClick={() => handleDeleteItem(index)} title="Put in trash">
                        <FaTrash />
                      </button>
                    )
                    }
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingContentIndex !== null && (
        <div style={{ marginBottom: '15px' }}>
          <h4>Editing Content of <i>{items[editingContentIndex].name}</i></h4>
          <textarea
            value={textEditorValue}
            onChange={(e) => setTextEditorValue(e.target.value)}
            rows={10}
            cols={30}
          />
          <div>
            <button onClick={handleSaveContent}><FaCheck /></button>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <button onClick={() => setEditingContentIndex(null)}><FaTimes /></button>
          </div>
        </div>
      )}
      {(items.length > 0) && (
        <div>
          <button onClick={handleEmptyTrash} disabled={nbTrashItems === 0} title='Empty trash'>
            <i className="pi pi-trash" style={{ fontSize: '2rem' }}></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default EditableList;
