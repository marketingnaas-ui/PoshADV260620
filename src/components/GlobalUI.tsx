import React from 'react';
import { useApp } from '../context/AppContext';

export const GlobalUI = () => {
  const { toastState, modal, drawer, closeDrawer } = useApp();

  return (
    <>
      <div className={`toast ${toastState.show ? 'show' : ''} ${toastState.type ? `t${toastState.type}` : ''}`}>
        {toastState.msg}
      </div>

      <div className={`mov ${modal.show ? 'open' : ''}`}>
        <div className="modal">
          <div className="mo-t">{modal.title}</div>
          <div className="mo-d">{modal.desc}</div>
          <div className="mo-a">{modal.actions}</div>
        </div>
      </div>

      <div className={`dov ${drawer.show ? 'open' : ''}`} onClick={closeDrawer}></div>
      <div className={`drw ${drawer.show ? 'open' : ''}`}>
        <div className="dh">{drawer.hdr}</div>
        <div className="db">{drawer.body}</div>
        <div className="df">{drawer.foot}</div>
      </div>
    </>
  );
};
