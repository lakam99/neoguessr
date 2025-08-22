import React from 'react';

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

export default function GuessMap({ googleReady, guess, answer, onGuess, interactive=true, className='' }){
  const ref=React.useRef(null); const mapRef=React.useRef(null);
  const gRef=React.useRef(null); const aRef=React.useRef(null); const lineRef=React.useRef(null);

  React.useEffect(()=>{
    if(!googleReady || !ref.current || mapRef.current) return;
    const google=window.google;
    const map=new google.maps.Map(ref.current,{
      center:{lat:20,lng:0}, zoom:2, streetViewControl:false, mapTypeControl:false, fullscreenControl:false,
      gestureHandling: interactive ? 'greedy' : 'none', mapId: MAP_ID
    });
    mapRef.current=map;
    try{
      const hidden=document.createElement('div'); hidden.style.width='0px'; hidden.style.height='0px';
      const dummy=new google.maps.StreetViewPanorama(hidden,{visible:false}); map.setStreetView(dummy);
    }catch{}
    if (interactive && onGuess){
      map.addListener('click', e => onGuess([e.latLng.lat(), e.latLng.lng()]));
    }
  }, [googleReady, interactive, onGuess]);

  React.useEffect(()=>{
    const google=window.google, map=mapRef.current; if(!google||!map) return;
    const hasAdv=!!(google.maps.marker && google.maps.marker.AdvancedMarkerElement);

    // Guess marker
    if(guess){
      const pos={lat:guess[0], lng:guess[1]};
      if(!gRef.current){
        if(hasAdv){
          const el=document.createElement('div'); Object.assign(el.style,{width:'14px',height:'14px',borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 0 2px rgba(34,197,94,0.35)'});
          gRef.current=new google.maps.marker.AdvancedMarkerElement({map, position:pos, content:el, title:'Your guess'});
        } else {
          gRef.current=new google.maps.Marker({map, position:pos, title:'Your guess'});
        }
      } else { if(hasAdv) gRef.current.position=pos; else gRef.current.setPosition(pos); }
    } else if(gRef.current){
      if(gRef.current.map) { if(gRef.current.setMap) gRef.current.setMap(null); else gRef.current.map=null; }
      gRef.current=null;
    }

    // Answer marker
    if(answer){
      const pos={lat:answer.lat, lng:answer.lng};
      if(!aRef.current){
        if(hasAdv){
          const el=document.createElement('div'); Object.assign(el.style,{width:'14px',height:'14px',borderRadius:'50%',background:'#3b82f6',boxShadow:'0 0 0 2px rgba(59,130,246,0.35)'});
          aRef.current=new google.maps.marker.AdvancedMarkerElement({map, position:pos, content:el, title:'Actual location'});
        } else {
          aRef.current=new google.maps.Marker({map, position:pos, title:'Actual location', icon:{path:google.maps.SymbolPath.CIRCLE,scale:6,fillColor:'#3b82f6',fillOpacity:1,strokeWeight:1}});
        }
      } else { if(hasAdv) aRef.current.position=pos; else aRef.current.setPosition(pos); }
    } else if(aRef.current){
      if(aRef.current.map) { if(aRef.current.setMap) aRef.current.setMap(null); else aRef.current.map=null; }
      aRef.current=null;
    }

    // Line + fit bounds
    if(answer && guess){
      const path=[{lat:guess[0],lng:guess[1]},{lat:answer.lat,lng:answer.lng}];
      if(!lineRef.current){ lineRef.current=new google.maps.Polyline({map, path, geodesic:true}); }
      else { lineRef.current.setPath(path); lineRef.current.setMap(map); }
      const b=new google.maps.LatLngBounds(); b.extend(path[0]); b.extend(path[1]); map.fitBounds(b, 40);
    } else if(lineRef.current){
      lineRef.current.setMap(null); lineRef.current=null;
      if(answer && !guess){ map.setCenter({lat:answer.lat, lng:answer.lng}); map.setZoom(4); }
    }
  }, [guess, answer]);

  return <div ref={ref} className={`w-full h-full bg-slate-900 rounded-2xl ${className}`} />;
}
