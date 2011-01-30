/* -*- Mode: Javascript; -*- */

var codex_social_id="$Id$";
var codex_social_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009 beingmeta, inc.
   This file implements a Javascript/DHTML UI for reading
    large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knodules, visit www.knodules.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.

   This program comes with absolutely NO WARRANTY, including implied
   warranties of merchantability or fitness for any particular
   purpose.

    Use and redistribution (especially embedding in other
      CC licensed content) is permitted under the terms of the
      Creative Commons "Attribution-NonCommercial" license:

          http://creativecommons.org/licenses/by-nc/3.0/ 

    Other uses may be allowed based on prior agreement with
      beingmeta, inc.  Inquiries can be addressed to:

       licensing@beingmeta.com

   Enjoy!

*/

(function(){

    var sbook_sources=false;
    var sbook_glosses_target=false;
    var sbookGlossesHUD=false;
    var sbookSourceHUD=false;

    // The highlighted glossmark
    var sbook_glossmark=false;
    var sbook_glossmark_qricons=false;

    // The glosses element
    var CodexHUDglosses=false;
    // The user/tribe bar
    var CodexHUDsocial=false;

    /* Social UI components */

    function sbicon(name,suffix) {return sbook.graphics+name+(suffix||"");}

    function addSource(info,withgloss){
	if (typeof info === 'string') info=fdjtKB.ref(info);
	var humid=info.humid;
	if (!(info.name)) return;
	if (withgloss) {
	    var icon=fdjtID("SBOOKSOURCEICON"+humid);
	    if (!(icon)) { // Add icon to the sources bar
		var pic=(info.pic)||
		    ((info.fbid)&&("https://graph.facebook.com/"+info.fbid+"/picture?type=square"));
		var kind=info.kind;
		if (pic) {}
		else if (kind===':PERSON')
		    pic=sbicon("sbooksperson50x50.png");
		else if (kind===':CIRCLE')
		    pic=sbicon("sbookscircle50x50.png");
		else if (kind===':OVERDOC')
		    pic=sbicon("sbooksoverdoc50x50.png");
		else pic=sbook;
		icon=fdjtDOM.Image(pic,".button.source",info.name|info.kind,
				   ("click to show/hide glosses from "+info.name));
		icon.oid=info.oid; icon.id="SBOOKSOURCEICON"+humid;
		fdjtDOM(fdjtID("SBOOKSOURCES")," ",icon);}}
	var sharetag=fdjtID("SBOOKSHARETAG"+humid);
	if (!(sharetag)) { // Add entry to the share cloud
	    var completion=fdjtDOM("span.completion.cue.source",info.name);
	    completion.id="SBOOKSHARETAG"+humid;
	    completion.setAttribute("value",info.qid);
	    completion.setAttribute("key",info.name);}
	var sourcetag=fdjtID("SBOOKSOURCETAG"+humid);
	if (!(sourcetag)) { // Add entry to the share cloud
	    var completion=fdjtDOM("span.completion.source",info.name);
	    completion.id="SBOOKSOURCETAG"+humid;
	    completion.setAttribute("value",info.qid);
	    completion.setAttribute("key",info.name);
	    fdjtDOM(fdjtID("CODEXGLOSSCLOUDSOURCES"),completion," ");
	    if (sbook.gloss_cloud)
	      sbook.gloss_cloud.addCompletion(completion);}
	// This is tricky because fdjtID may not work when the full
	//  cloud is not in the DOM for some reason
	var searchtag=
	  fdjtID("CODEXSEARCHSOURCE"+humid)||
	  ((sbook.full_cloud)&&(sbook.full_cloud.getByValue(info.qid)));
	if ((!(searchtag))||(searchtag.length===0)) {
	  // Add entry to the search cloud
	  var completion=fdjtDOM("span.completion.source",info.name);
	  completion.id="CODEXSEARCHSOURCE"+humid;
	  completion.setAttribute("value",info.qid);
	  completion.setAttribute("key",info.name);
	  fdjtDOM(fdjtID("CODEXSEARCHCLOUD"),completion," ");
	  if (sbook.full_cloud)
	    sbook.full_cloud.addCompletion(completion);}
	return info;};
    sbook.UI.addSource=addSource;
    sbook.UI.addGlossSource=function(info){addSource(info,true);};

    function everyone_onclick(evt)
    {
	evt=evt||event||null;
	var target=fdjtDOM.T(evt);
	// var sources=fdjtDOM.getParent(target,".sbooksources");
	// var glosses=fdjtDOM.getParent(target,".sbookglosses");
	var sources=fdjtID("SBOOKSOURCES");
	var glosses=fdjtID("CODEXALLGLOSSES");
	var new_sources=[];
	if ((!(sources))||(!(glosses)))
	    return; /* Warning? */
	if (fdjtDOM.hasClass(target,"selected")) {
	    CodexMode(false);
	    fdjtDOM.cancel(evt);
	    return;}
	var selected=fdjtDOM.$(".selected",sources);
	fdjtLog("Everyone click sources=%o glosses=%o selected=%o/%d",
		sources,glosses,selected,selected.length);
	fdjtDOM.toggleClass(selected,"selected");
	fdjtDOM.addClass(target,"selected");
	sbook.UI.selectSources(glosses,false);
	fdjtDOM.cancel(evt);
    }
    sbook.UI.handlers.everyone_onclick=everyone_onclick;

    function sources_onclick(evt)
    {
	evt=evt||event||null;
	// if (!(sbook.user)) return;
	var target=fdjtDOM.T(evt);
	// var sources=fdjtDOM.getParent(target,".sbooksources");
	// var glosses=fdjtDOM.getParent(target,".sbookglosses");
	var sources=fdjtID("SBOOKSOURCES");
	var glosses=fdjtID("CODEXALLGLOSSES");
	var new_sources=[];
	if ((!(sources))||(!(glosses))||(!(target.oid)))
	    return; /* Warning? */
	if ((evt.shiftKey)||(fdjtDOM.hasClass(target,"selected"))) {
	    fdjtDOM.toggleClass(target,"selected");
	    var selected=fdjtDOM.$(".selected",sources);
	    var i=0; var len=selected.length;
	    while (i<len) {
		var oid=selected[i++].oid;
		if (oid) new_sources.push(oid);}}
	else {
	    var selected=fdjtDOM.$(".selected",sources);
	    var i=0; var len=selected.length;
	    while (i<len) fdjtDOM.dropClass(selected[i++],"selected");
	    fdjtDOM.addClass(target,"selected");
	    new_sources=[target.oid];}
	var everyone=fdjtDOM.$(".everyone",sources)[0];
	if (new_sources.length) {
	    if (everyone) fdjtDOM.dropClass(everyone,"selected");
	    sbook.UI.selectSources(glosses,new_sources);}
	else {
	    if (everyone) fdjtDOM.addClass(everyone,"selected");
	    sbook.UI.selectSources(glosses,false);}
	fdjtDOM.cancel(evt);
    }
    sbook.UI.handlers.sources_onclick=sources_onclick;

    sbook.UI.addGlossmark=function(id){
	var target=fdjtID(id);
	if (!(target)) return false;
	var glossmarkid="SBOOK_GLOSSMARK_"+id;
	if (fdjtID(glossmarkid)) return fdjtID(glossmarkid);
	var imgsrc=(sbicon("sbookspeople32x32.png"));
	var glossmark=fdjtDOM
	("span.sbookglossmark",
	 fdjtDOM.Image(imgsrc,"big","comments"),
	 fdjtDOM.Image(sbicon("Asterisk16x16.png"),"tiny","+"));
	glossmark.id=glossmarkid;
	sbook.UI.addHandlers(glossmark,"glossmark");
	if (sbook_glossmark_qricons) {
	    var qrhref="http://"+sbook.server+"/v3/qricon.png?"+
		"URI="+encodeURIComponent(sbook.refuri)+
		((id)?("&FRAG="+id):"")+
		((title) ? ("&TITLE="+encodeURIComponent(title)) : "");
	    var i=0; while (i<tags.length) qrhref=qrhref+"&TAGCUE="+tags[i++];
	    fdjtDOM.prepend(target,fdjtDOM.Image(qrhref,"sbookqricon"));}
	fdjtDOM.addClass(target,"glossed");
	fdjtDOM.prepend(target,glossmark);
	glossmark.glosses=[];
	glossmark.sbookui=true;
	return glossmark;};

    function openGlossmark(target,addmark) {
	var glosses=sbook.glosses.find('frag',target.id);
	var sumdiv=fdjtDOM("div.codexslice.hudpanel");
	if ((!(glosses))||(!(glosses.length)))
	    fdjtDOM.addClass(sumdiv,"noglosses");
	sbook.UI.setupSummaryDiv(sumdiv);
	if (glosses)
	  sbook.UI.showSlice(glosses,sumdiv,false);
	fdjtDOM.replace("CODEXGLOSSES",sumdiv);
	sbook.setTarget(target);
	fdjtDOM.replace("SBOOKINFO",
			sbook.glossBlock(target.id,"div.sbookgloss"));
	CodexMode("glosses");
	var glosshud=fdjtID("CODEXGLOSSES");
	var height=glosshud.offsetHeight;
	var geom=fdjtDOM.getGeometry(target,sbook.body);
	var scrollpos=sbook.scrollPos();
	var window_height=fdjtDOM.viewHeight();
	glosshud.style.maxHeight=(window_height-150)+'px';
	var hudoff=geom.top-scrollpos.y;
	var height=glosshud.offsetHeight;
	fdjtLog("top=%o height=%o x,y=%o,%o wh=%o ho=%o ht=%o",
		geom.top,geom.height,scrollpos.x,scrollpos.y,window_height,hudoff,height);
	if ((hudoff+height)>(window_height-50)) {
	    var overhang=(hudoff+height)-(window_height-50);
	    if ((hudoff-overhang)<50) hudoff=50;
	    else hudoff=hudoff-overhang;}
	glosshud.style.top=hudoff+'px';}
    sbook.openGlossmark=openGlossmark;

})();

fdjt_versions.decl("codex",codex_social_version);
fdjt_versions.decl("codex/social",codex_social_version);

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
