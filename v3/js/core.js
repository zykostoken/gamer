// zykos-core.js - CONTRATO MADRE
// Gestiona sesion, DNI, Supabase, modulos. No captura nada.
;(function(G){'use strict';
var _mods={},_sid=null,_dni=null,_sb=null,_ctx='loading',_t0=performance.now(),_on=false;
var C={
  boot:function(){
    var p=new URLSearchParams(window.location.search);
    _dni=p.get('dni')||null;
    try{if(!_dni)_dni=localStorage.getItem('zykos_patient_dni');}catch(e){}
    if(!_dni)return;
    _sid='zs_'+Date.now()+'_'+Math.random().toString(36).substr(2,6);
    _t0=performance.now();
    try{sessionStorage.setItem('zykos_sid',_sid);}catch(e){}
    _sb=(typeof getSupabaseClient==='function')?getSupabaseClient():null;
    Object.keys(_mods).forEach(function(n){
      try{_mods[n].start({sid:_sid,dni:_dni,t0:_t0,sb:_sb,ctx:_ctx});}catch(e){console.warn('[core]',n,e.message);}
    });
    _on=true;
  },
  shutdown:function(){
    if(!_on)return;
    Object.keys(_mods).forEach(function(n){try{_mods[n].stop();}catch(e){}});
    _on=false;_sid=null;
  },
  register:function(name,mod){
    if(!mod||typeof mod.start!=='function'||typeof mod.stop!=='function'){console.warn('[core] bad module:',name);return;}
    _mods[name]=mod;
    if(_on&&_dni)try{mod.start({sid:_sid,dni:_dni,t0:_t0,sb:_sb,ctx:_ctx});}catch(e){}
  },
  setContext:function(ctx){
    _ctx=ctx||'unknown';
    Object.keys(_mods).forEach(function(n){if(typeof _mods[n].onContext==='function')try{_mods[n].onContext(_ctx);}catch(e){}});
  },
  write:async function(source,metricName,value,metadata){
    if(!_sb||!_dni)return;
    try{
      var r=await _sb.from('zykos_metrics').insert({session_id:_sid,patient_dni:_dni,source:source,context:_ctx,metric_name:metricName,metric_value:value,metric_data:metadata||null,t_ms:Math.round(performance.now()-_t0),created_at:new Date().toISOString()});
      if(r.error)console.warn('[core] write:',r.error.message);
    }catch(e){console.warn('[core] write fail:',e.message);}
  },
  writeBatch:async function(source,rows){
    if(!_sb||!_dni||!rows||!rows.length)return;
    var p=rows.map(function(r){return{session_id:_sid,patient_dni:_dni,source:source,context:r.context||_ctx,metric_name:r.metric_name,metric_value:r.metric_value||null,metric_data:r.metric_data||null,t_ms:r.t_ms||0,created_at:new Date().toISOString()};});
    try{var r=await _sb.from('zykos_metrics').insert(p);if(r.error)console.warn('[core] batch:',r.error.message);}catch(e){}
  },
  writeStream:async function(events,idx){
    if(!_sb||!_dni)return;
    try{await _sb.from('zykos_raw_stream').insert({session_id:_sid,patient_dni:_dni,chunk_index:idx,context:_ctx,events:events,event_count:events.length});}catch(e){}
  },
  getSid:function(){return _sid;},getDni:function(){return _dni;},getContext:function(){return _ctx;},getT0:function(){return _t0;},getSb:function(){return _sb;},isActive:function(){return _on&&_sid!==null;}
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',C.boot);else C.boot();
window.addEventListener('beforeunload',C.shutdown);
document.addEventListener('visibilitychange',function(){if(document.hidden&&C.isActive())Object.keys(_mods).forEach(function(n){if(typeof _mods[n].flush==='function')try{_mods[n].flush();}catch(e){}});});
G.ZYKOS=C;
})(typeof window!=='undefined'?window:this);
