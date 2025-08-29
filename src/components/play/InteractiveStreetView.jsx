import React from "react";

function InteractiveStreetView({ googleReady, panoLatLng }){
  const ref=React.useRef(null); const panoRef=React.useRef(null);
  React.useEffect(()=>{
    if(!googleReady||!ref.current||!panoLatLng) return;
    const google=window.google;
    if(!panoRef.current){
      panoRef.current = new google.maps.StreetViewPanorama(ref.current,{
        position:panoLatLng, pov: { heading:0, pitch:0 }, zoom:0,
        motionTracking:false, motionTrackingControl:false,
        addressControl:false, showRoadLabels:false, linksControl:true,
        zoomControl:true, clickToGo:true, fullscreenControl:true
      });
    } else {
      try{ panoRef.current.setPosition(panoLatLng); }catch{}
    }
  },[googleReady,panoLatLng]);
  return <div ref={ref} className="w-full h-full bg-black rounded-2xl" />;
}

export default InteractiveStreetView;
