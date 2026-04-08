import React from 'react';
import './CartelaModal.css';

const CartelaModal = ({ show, cartela, luckyNumber, onConfirm, onCancel, onClose }) => {
  if (!show || !cartela) return null;

  const convertToGrid = (cartelaData) => {
    const grid = [];
    for (let row = 0; row < 5; row++) {
      const rowData = [];
      rowData.push(cartelaData.B[row]);
      rowData.push(cartelaData.I[row]);
      rowData.push(cartelaData.N[row]);
      rowData.push(cartelaData.G[row]);
      rowData.push(cartelaData.O[row]);
      grid.push(rowData);
    }
    return grid;
  };

  const grid = convertToGrid(cartela.card_data || cartela);

  return (
    <div className="cartela-modal-overlay">
      <div className="cartela-modal">
        <h2>🎯 Lucky Number: {luckyNumber}</h2>
        <div className="cartela-preview">
          <table className="bingo-card-preview">
            <thead>
              <tr>
                <th>B</th>
                <th>I</th>
                <th>N</th>
                <th>G</th>
                <th>O</th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, colIndex) => (
                    <td key={colIndex} className={cell === 'FREE' ? 'free-space' : ''}>
                      {cell === 'FREE' ? '⭐' : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-buttons">
          <button className="confirm-btn" onClick={onConfirm}>
            ✅ Select This Cartela
          </button>
          <button className="cancel-btn" onClick={onCancel}>
            🔄 Try Another Number
          </button>
          <button className="close-btn" onClick={onClose}>
            ✕ Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartelaModal;