Store.probe();
const GO=(()=>{try{return new URLSearchParams(location.search).get('go')}catch(e){return null}})();
if(Remote.on){render();Remote.init().then(()=>render())}else{restoreLocal();render()}
if(typeof setInterval!=='undefined')setInterval(()=>{if(me&&!sessAlive())forceOut()},5000);
