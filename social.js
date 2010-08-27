/* -*- Mode: Javascript; -*- */

var sbooks_social_id="$Id$";
var sbooks_social_version=parseInt("$Revision$".slice(10,-1));

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
    var sbookHUDglosses=false;
    // The user/tribe bar
    var sbookHUDsocial=false;

    /* Social UI components */

    function sbicon(name,suffix) {return sbook.graphics+name+(suffix||"");}

    sbook.UI.addSourceIcon=function(info){
	if (typeof info === 'string') info=fdjtKB.ref(info);
	var humid=info.humid;
	var icon=fdjtID("SBOOKSOURCEICON"+humid);
	if (icon) return icon;
	if (!(info.name)) return;
	var pic=info.pic; var kind=info.kind;
	if (pic) {}
	else if (kind===':PERSON')
	    pic=sbicon("sbooksperson40x40.png");
	else if (kind===':CIRCLE')
	    pic=sbicon("sbookscircle40x40.png");
	else if (kind===':OVERDOC')
	    pic=sbicon("sbooksoverdoc40x40.png");
	else pic=sbook;
	icon=fdjtDOM.Image
	(pic,".button.source",info.name|info.kind,
	 ("click to show/hide glosses from "+info.name));
	icon.oid=info.oid; icon.id="SBOOKSOURCEICON"+humid;
	fdjtDOM(fdjtID("SBOOKSOURCES")," ",icon);
	return icon;};

    function everyone_onclick(evt)
    {
	evt=evt||event||null;
	var target=fdjtDOM.T(evt);
	// var sources=fdjtDOM.getParent(target,".sbooksources");
	// var glosses=fdjtDOM.getParent(target,".sbookglosses");
	var sources=fdjtID("SBOOKSOURCES");
	var glosses=fdjtID("SBOOKALLGLOSSES");
	var new_sources=[];
	if ((!(sources))||(!(glosses)))
	    return; /* Warning? */
	if (fdjtDOM.hasClass(target,"selected")) {
	    sbookMode(false);
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
	var glosses=fdjtID("SBOOKALLGLOSSES");
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
	("span.glossmark",
	 fdjtDOM.Image(imgsrc,"big","comments"),
	 //fdjtDOM.Image(sbicon("sbicon16x16.png"),"tiny","+"),
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
	var sumdiv=fdjtDOM("div.sbookslice.hudblock");
	sbook.UI.setupSummaryDiv(sumdiv);
	if (glosses)
	  sbook.UI.showSlice(glosses,sumdiv,false);
	fdjtDOM.replace("SBOOKGLOSSES",sumdiv);
	sbook.setTarget(target);
	fdjtDOM.replace("SBOOKINFO",sbook.glossBlock(target.id,"div.sbookgloss.hudblock"));
	sbookMode("glosses");}
    sbook.openGlossmark=openGlossmark;

})();

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
