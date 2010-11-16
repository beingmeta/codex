/* -*- Mode: Javascript; -*- */

var sbooks_slices_id="$Id$";
var sbooks_slices_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009-2010 beingmeta, inc.
   This file implements the search component of a 
    Javascript/DHTML UI for reading large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knodules, visit www.knodules.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.
   This file assumes that the sbooks.js file has already been loaded.

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

var sbook_eye_icon="EyeIcon25.png";
var sbook_small_eye_icon="EyeIcon13x10.png";
var sbook_details_icon="detailsicon16x16.png";
var sbook_outlink_icon="outlink16x16.png";
var sbook_small_remark_icon="remarkballoon16x13.png";
var sbook_delete_icon="redx12x12.png";

(function () {

    function renderNote(info,query,idprefix,standalone){
	var key=info.qid||info.oid||info.id;
	var target_id=(info.frag)||(info.id);
	var target=((target_id)&&(fdjtID(target_id)));
	var target_info=sbook.docinfo[target_id];
	var refiners=((query) && (query._refiners));
	var score=((query)&&(query[key]));
	var div=
	    fdjtDOM(((info.tstamp) ? "div.sbooknote.gloss" : "div.sbooknote"),
		    ((standalone)&&(makelocbar(target_info))),
		    // (makelocrule(target_info,target_info.head)),
		    ((info.tstamp)&&(showglossinfo(info)))," ",
		    // Makes it noisy (and probably slow) on the iPad
		    ((standalone)&&(showtocloc(target_info))),
		    ((score)&&(showscore(score))),
		    ((info.note)&&(fdjtDOM("span.note",info.note))),
		    ((info.tags)&&(info.tags.length)&&(showtags(info.tags))),
		    ((info.audience)&&(info.audience.length)&&
		     (showaudience(info.audience))),
		    ((info.excerpt)&&(fdjtDOM("span.excerpt",info.excerpt))),
		    ((info.xrefs)&&(showlinks(info.xrefs,"span.xrefs"))),
		    ((info.attachments)&&
		     (showlinks(info.attachments,"span.attachments"))));
	if (!(info.tstamp))
	    div.title=
	    "click to preview\n"+
	    (sbook.getTitle(target)||fdjtDOM.textify(target))
	    .replace(/\n\n+/g,"\n").replace(/^\n+/,"");
	div.about="#"+target_id;
	// div.setAttribute('about',"#"+info.id);
	if (idprefix) div.id=idprefix+info.id;
	if (info.qid) {
	    div.name=div.qref=info.qid;
	    div.setAttribute("name",info.qid);}
	return div;}
    sbook.renderNote=renderNote;
    
    function showtags(tags){
	var span=fdjtDOM("span.tags");
	if (!(tags instanceof Array)) tags=[tags];
	var i=0; var lim=tags.length;
	// This might do some kind of more/less controls and sorted
	// or cloudy display
	while (i<tags.length) {
	    var tag=tags[i];
	    fdjtDOM.append(span,((i>0)?" \u00b7 ":" "),Knodule.HTML(tag));
	    i++;}
	return span;}
    function showaudience(tags){
	var span=fdjtDOM("span.audience");
	if (!(tags instanceof Array)) tags=[tags];
	var i=0; var lim=tags.length;
	// This might do some kind of more/less controls and sorted
	// or cloudy display
	while (i<tags.length) {
	  var tag=tags[i]; var info=fdjtKB.ref(tag);
	  fdjtDOM.append(span,((i>0)?" \u00b7 ":" "),info.name);
	  i++;}
	return span;}
    function showlinks(refs,spec){
	var span=fdjtDOM(spec);
	for (url in refs) {
	    var urlinfo=refs[url];
	    var title=urlinfo.title;
	    var icon=fdjtDOM.Image(sbicon("outlink16x8.png"));
	    var anchor
	    ((url===title)?(fdjtDOM.anchor(url,"a.raw",icon)):
	     (fdjtDOM.anchor(url,{title:url},title)));
	    anchor.target='_blank';
	    fdjtDOM(span,anchor,"\n");}
	return span;}
    function showscore(score){
	var scorespan=fdjtDOM("span.score");
	var score=query[key]; var k=0;
	while (k<score) {fdjtDOM(scorespan,"*"); k++;}
	return scorespan;}
    function showglossinfo(info) {
	var user=info.user;
	var feed=info.feed||false;
	var userinfo=sbook.sourcekb.map[user];
	var feedinfo=sbook.sourcekb.map[feed];
	var agestring=timestring(info.tstamp);
	var age=fdjtDOM("span.age",agestring);
	age.title=((user===sbook.user)?("edit this gloss"):
		   ("relay/reply to this gloss"));
	age.onclick=relayoredit_gloss;
	
	var deleteicon=
	    // No delete icons for the ipad
	    ((user===sbook.user.oid)&&(sbook.ui!=='ios')&&
	     (fdjtDOM.Image(sbicon(sbook_delete_icon),"img.delete","x",
			    "delete this gloss")))
	if (deleteicon) deleteicon.onclick=deletegloss_onclick;
	
	return [fdjtDOM("span.glossinfo",age,deleteicon),
		(((info.pic)&&(fdjtDOM.Image((info.pic),"glosspic",userinfo.name)))||
		 ((userinfo.pic)&&(fdjtDOM.Image((userinfo.pic),"userpic",userinfo.name)))||
		 ((userinfo.fbid)&&
		  (fdjtDOM.Image("https://graph.facebook.com/"+userinfo.fbid+"/picture?type=square",
				 "userpic",userinfo.name)))),
	       	(((userinfo)&&((userinfo.name)||(userinfo.userid)))&&
		 (fdjtDOM("span.user",((userinfo.name)||(userinfo.userid)))))];}
    var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function timestring(tick){
	var now=fdjtTime.tick();
	if ((now-tick)<(12*3600)) {
	    var date=new Date(1000*tick);
	    var hour=date.getHours();
	    var minute=date.getMinutes();
	    return ""+hour+":"+((minute<10)?"0":"")+minute;}
	else {
	    var date=new Date(1000*tick);
	    var year=date.getFullYear();
	    var month=date.getMonth();
	    var date=date.getDate();
	    var shortyear=year%100;
	    if (year<10)
		return ""+date+"/"+months[month]+"/0"+year;
	    else return ""+date+"/"+months[month]+"/"+year;}}

    function makelocbar(target_info,cxt_info){
	var locrule=fdjtDOM("HR");
	var locbar=fdjtDOM("DIV.locbar",locrule);
	var target_start=target_info.starts_at;
	var target_end=target_info.ends_at;
	var target_len=target_end-target_start;
	if (!(cxt_info)) cxt_info=sbook.docinfo[document.body.id];
	var cxt_start=cxt_info.starts_at;
	var cxt_end=cxt_info.ends_at;
	var cxt_len=cxt_end-cxt_start;
	locbar.setAttribute("debug","ts="+target_start+"; te="+target_end+"; cl="+cxt_len);
	locrule.style.width=((target_len/cxt_len)*100)+"%";
	locrule.style.left=(((target_start-cxt_start)/cxt_len)*100)+"%";
	var id=target_info.id||target_info.frag;
	if (id) {
	    locbar.about="#"+id;
	    locbar.title=sumText(fdjtID(id));}
	return locbar;}
    function showtocloc(target_info){
	var head=((target_info.toclevel)?(target_info):(target_info.head));
	var heads=head.heads;
	var anchor=fdjtDOM.Anchor(
	    "javascript:sbook.JumpTo('"+(head.frag||head.id)+"');","a.headref",
	    fdjtDOM("span.spacer","\u00A7"),
	    head.title);
	var title="jump to "+head.title;
	var i=heads.length-1; 
	while (i>0) {
	    var head=heads[i--]; title=title+"// "+head.title;}
	anchor.title=title;
	return [" ",anchor];}

    function makelocspan(target_info,cxtinfo){
	if (!(cxtinfo)) cxtinfo=sbook.docinfo[(sbook.body||document.body).id];
	var locrule=fdjtDOM("div.locrule");
	var cxt_start=cxtinfo.starts_at;
	var cxt_end=cxtinfo.ends_at;
	var cxt_len=cxt_end-cxt_start;
	var location_start=target_info.starts_at-cxt_start;
	var location_len=target_info.ends_at-target_info.starts_at;
	locrule.setAttribute("about","#"+(target_info.id||target_info.frag));
	locrule.title='click or hold to glimpse';
	locrule.style.width=((location_len/cxt_len)*100)+"%";
	locrule.style.left=((location_start/cxt_len)*100)+"%";
	return locrule;}
    function makelocrule(target_info,cxtinfo){
	if (!(cxtinfo)) cxtinfo=sbook.docinfo[(sbook.body||document.body).id];
	var locrule=fdjtDOM("hr.locrule");
	var cxt_start=cxtinfo.starts_at;
	var cxt_end=cxtinfo.ends_at;
	var cxt_len=cxt_end-cxt_start;
	var target_start=target_info.starts_at-cxt_start;
	var target_len=target_info.ends_at-target_info.starts_at;
	var locstring="~"+Math.ceil(target_len/5)+ " words long ~"+
	    Math.ceil((target_start/cxt_len)*100)+"% along";
	locrule.setAttribute("about","#"+(target_info.id||target_info.frag));
	locrule.locstring=locstring+".";
	locrule.title=locstring+": click or hold to glimpse";
	locrule.style.width=((target_len/cxt_len)*100)+"%";
	locrule.style.left=((target_start/cxt_len)*100)+"%";
	return locrule;}

    function deletegloss_onclick(evt){
	var scan=fdjtUI.T(evt);
	fdjtUI.cancel(evt);
	while (scan) {
	    if (scan.qref) break;
	    else scan=scan.parentNode;}
	if (!(scan)) return;
	var qref=scan.qref;
	var frag=sbook.glosses.ref(qref).get("frag");
	if (scan)
	    fdjtAjax.jsonCall(
		function(response){deletegloss(response,qref,frag);},
		"https://"+sbook.server+"/v4/delete",
		"gloss",scan.qref);}
    function deletegloss(response,glossid,frag){
	if (response===glossid) {
	    sbook.glosses.drop(glossid);
	    sbook.allglosses=fdjtKB.remove(sbook.allglosses,glossid);
	    if (sbook.offline)
		fdjtState.setLocal("glosses("+sbook.refuri+")",
				   sbook.allglosses,true);
	    var renderings=fdjtDOM.Array(document.getElementsByName(glossid));
	    if (renderings) {
		var i=0; var lim=renderings.length;
		while (i<lim) fdjtDOM.remove(renderings[i++]);}
	    var glossmark=fdjtID("SBOOK_GLOSSMARK_"+frag);
	    if (glossmark) {
		var newglosses=fdjtKB.remove(glossmark.glosses,glossid);
		if (newglosses.length===0) fdjtDOM.remove(glossmark);
		else glossmark.glosses=newglosses;}}
	else alert(response);}
    
    function relayoredit_gloss(evt){
	var scan=fdjtUI.T(evt);
	fdjtUI.cancel(evt);
	while (scan) {
	    if (scan.qref) break;
	    else scan=scan.parentNode;}
	if (!(scan)) return;
	var qref=scan.qref;
	var gloss=sbook.glosses.ref(qref);
	var frag=gloss.get("frag");
	sbook.setGlossTarget(gloss);
	sbookMode("addgloss");}

    function sourceIcon(info){
	if (info) return info.pic;}
    
    function sbicon(name,suffix) {return sbook.graphics+name+(suffix||"");}

    // Displayings sets of notes organized into threads

    function sortbyloctime(x,y){
	if (x.starts_at<y.starts_at) return -1;
	else if (x.starts_at>y.starts_at) return 1;
	if ((x.tstamp)&&(y.tstamp)) {
	    if (x.tstamp<y.tstamp) return -1;
	    else if (x.tstamp>y.tstamp) return 1;
	    else return 0;}
	else if (x.tstamp) return 1;
	else if (y.tstamp) return -1;
	else return 0;}

    function showSlice(results,div,scores,sort){
	var notes=new Array(results.length);
	var i=0; var lim=results.length;
	while (i<lim) {
	    var r=results[i];
	    if (typeof r === 'string') {
		var ref=sbook.docinfo[r]||sbook.glosses.ref(r);
		if (!(ref)) fdjtLog("[%fs] No resolution for %o",r);
		notes[i]=ref;}
	    else notes[i]=r;
	    i++;}
	if (!(sort)) {}
	else if (scores)
	    notes.sort(function(n1,n2){
		var s1=(scores[n1.qid]);
		var s2=(scores[n2.qid]);
		if ((s1)&&(s2)) {
		    if (s1>s2) return -1;
		    else if (s2>s1) return 1;}
		else if (s1) return -1;
		else if (s2) return 1;
		if (n1.starts_at<n2.starts_at) return -1;
		else if (n1.starts_at>n2.starts_at) return 1;
		else if ((n1.tstamp)&&(n2.tstamp)) {
		    if (n1.tstamp>n2.tstamp) return -1;
		    else if (n1.tstamp>n2.tstamp) return 1;
		    else return 0;}
		else if (n1.tstamp) return 1;
		else if (n2.tstamp) return -1;
		else return 0;});
	else notes.sort(function(n1,n2){
	    if (n1.starts_at<n2.starts_at) return -1;
	    else if (n1.starts_at>n2.starts_at) return 1;
	    else if ((n1.tstamp)&&(n2.tstamp)) {
		if (n1.tstamp>n2.tstamp) return -1;
		else if (n1.tstamp>n2.tstamp) return 1;
		else return 0;}
	    else if (n1.tstamp) return 1;
	    else if (n2.tstamp) return -1;
	    else return 0;});
	
	var headelt=false; var threadelt=false;
	var curhead=false; var curinfo=false;
	var i=0; var len=notes.length; while (i<len) {
	    var note=notes[i++];
	    var frag=note.id||note.frag;
	    if (!(frag)) continue;
	    var target=fdjtID(frag);
	    var docinfo=sbook.docinfo[target.id];
	    var headinfo=docinfo.head;
	    var head=document.getElementById(headinfo.frag);
	    var tochead=makeTOCHead(head);
	    if (curinfo!==docinfo) {
		if (headinfo!==curhead) {
		    headelt=fdjtDOM("div.sbookthread.tocthread",tochead);
		    fdjtDOM.append(div,headelt);
		    curhead=headinfo;}
		threadelt=fdjtDOM("div.sbookthread.idthread",
				  makeIDHead(target,headinfo,true));
		threadelt.about="#"+frag;
		threadelt.title="(click to preview)\n"+
		    (sbook.getTitle(target)||fdjtDOM.textify(target))
		    .replace(/\n\n+/g,"\n").replace(/^\n+/,"");
		fdjtDOM.append(headelt,threadelt);
		curinfo=docinfo;}
	    fdjtDOM.append(threadelt,renderNote(note));}
	return div;}
    sbook.UI.showSlice=showSlice;
    
    function sumText(target){
	var title=(sbook.getTitle(target)||fdjtDOM.textify(target)).
	    replace(/\n\n+/g,"\n");
	if (title.length<40) return title;
	else return title.slice(0,40)+"\u22ef ";}
    
    function makeTOCHead(target,head){
	if (!(head)) head=sbook.getHead(target);
	var basespan=fdjtDOM("span");
	basespan.title='click to jump';
	var title=(sbook.getTitle(target)||fdjtDOM.textify(target)).
	    replace(/\n\n+/g,"\n");
	var info=sbook.docinfo[target.id];
	if (target!==head) {
	    var paratext=
		fdjtDOM.Anchor("javascript:sbook.JumpTo('"+target.id+"');",
			       "a.paratext",
			       fdjtDOM("span.spacer","\u00B6"),
			       sumText(target));
	    paratext.title='(click to jump) '+title;
	    fdjtDOM(basespan,paratext," ");}
	if (head) {
	    var headtext=
		fdjtDOM.Anchor("javascript:sbook.JumpTo('"+head.id+"');",
			       "a.headtext",
			       fdjtDOM("span.spacer","\u00A7"),
			       sumText(head));
	    var curspan=fdjtDOM("span.head",headtext);
	    fdjtDOM.append(basespan," ",curspan);
	    var heads=sbook.Info(head).heads;
	    if (heads) {
		var j=heads.length-1; while (j>=0) {
		    var hinfo=heads[j--]; var elt=fdjtID(hinfo.frag);
		    if ((!(elt))||(!(hinfo.title))||
			(elt===sbook.root)||(elt===document.body))
			continue;
		    var anchor=
			fdjtDOM.Anchor(
			    "javascript:sbook.JumpTo('"+hinfo.frag+"');",
			    "a.headtext",
			    fdjtDOM("span.spacer","\u00A7"),
			    hinfo.title);
		    var newspan=fdjtDOM("span.head"," ",anchor);
		    if (target===head) fdjtDOM(curspan,newspan);
		    else fdjtDOM(curspan," \u22ef ",newspan);
		    curspan=newspan;}}}
	var locrule=makelocrule(info);
	var tochead=fdjtDOM("div.tochead",locrule,basespan);
	tochead.title=locrule.locstring;
	return tochead;}

    function makeIDHead(target,headinfo,locrule){
	var info=sbook.docinfo[target.id];
	var headinfo=info.head;
	var tochead=fdjtDOM("div.idhead",
			    ((locrule)&&(makelocrule(info,headinfo))),
			    fdjtDOM("div",sumText(target)));
	var title="(click to preview)\n"+
	    (sbook.getTitle(target)||fdjtDOM.textify(target)).
	    replace(/\n\n+/g,"\n").replace(/^\n+/,"");
	return tochead;}

    function findTOCref(div,ref,loc) {
	var children=div.childNodes;
	if (!(children)) return false;
	var i=0; var lim=children.length;
	while (i<lim) {
	    var child=children[i++];
	    if (!(child.nodeType===1)) continue;
	    else if (child.tocref===ref) return child;
	    else if (child.starts>loc) return child;
	    else continue;}
	return false;}

    function addToSlice(note,div,query){
	var frag=(note.id||note.frag);
	var eltinfo=sbook.docinfo[frag];
	var about=document.getElementById(frag);
	var headinfo=((eltinfo.toclevel)?(eltinfo):(eltinfo.head));
	var headid=headinfo.frag;
	var head=document.getElementById(headid);
	var starts=note.starts_at;
	var head_starts=headinfo.starts_at;
	var insertion=false; var insdiff=0;
	var headelt=findTOCref(div,headid,head_starts);
	if ((!(headelt))||(headelt.tocref!==headid)) {
	    var insertion=headelt;
	    headelt=fdjtDOM("div.sbookthread.headthread",makeTOCHead(head,head));
	    headelt.tocref=headid; headelt.starts=head_starts;
	    if (insertion) fdjtDOM.insertBefore(insertion,headelt);
	    else fdjtDOM.append(div,headelt);}
	var idelt=((frag===headid)?(headelt):(findTOCref(headelt,frag,starts)));
	if ((!(idelt))||(idelt.tocref!==frag)) {
	    var insertion=idelt;
	    idelt=fdjtDOM("div.sbookthread.idthread",makeIDHead(about,headinfo));
	    idelt.tocref=frag; idelt.start=starts; idelt.about="#"+frag;
	    idelt.title="(click to preview)\n"+
		(sbook.getTitle(about)||fdjtDOM.textify(about))
		.replace(/\n\n+/g,"\n").replace(/^\n+/,"");

	    if (insertion) fdjtDOM.insertBefore(insertion,idelt);
	    else fdjtDOM.append(headelt,idelt);}
	var tstamp=note.tstamp; var qid=note.qid;
	var children=headelt.childNodes;
	var ishead=(frag===headid);
	var i=0; var lim=children.length;
	while (i<lim) {
	    var child=children[i++];
	    if (child.nodeType!==1) continue;
	    if ((ishead)&&(fdjtDOM.hasClass(child,"sbookthread"))) {
		fdjtDOM.insertBefore(child,renderNote(note));
		return;}
	    if (!((fdjtDOM.hasClass(child,"sbooknote"))||
		  (fdjtDOM.hasClass(child,"sbookthread"))))
		continue;
	    if (child.qref===qid) {
		fdjtDOM.replace(child,renderNote(note));
		return;}
	    if (child.tstamp<=tstamp) {
		fdjtDOM.insertBefore(child,renderNote(note));
		return;}
	    else continue;}
	fdjtDOM.append(idelt,renderNote(note));}
    sbook.UI.addToSlice=addToSlice;

    /* Selecting a subset of glosses to display */

    var hasClass=fdjtDOM.hasClass;

    function selectSourcesRecur(thread,sources){
	var empty=true; var children=thread.childNodes;
	var i=0; var lim=children.length;
	while (i<children.length) {
	    var child=children[i++];
	    if (child.nodeType!==1) continue;
	    if (hasClass(child,"sbooknote")) {
		var gloss=(child.qref)&&sbook.glosses.map[child.qref];
		if (!(gloss)) fdjtDOM.dropClass(child,"sourced");
		else if ((fdjtKB.contains(sources,gloss.user))||
			 (fdjtKB.contains(sources,gloss.feed))) {
		    fdjtDOM.addClass(child,"sourced");
		    empty=false;}
		else fdjtDOM.dropClass(child,"sourced");}
	    else if (hasClass(child,"sbookthread")) {
		if (!(selectSourcesRecur(child,sources)))
		    empty=false;}
	    else {}}
	if (!(empty)) fdjtDOM.addClass(thread,"sourced");
	else fdjtDOM.dropClass(thread,"sourced");
	return empty;}

    function selectSources(results_div,sources){
	if (!(sources)) {
	    fdjtDOM.dropClass(results_div,"sourced");
	    fdjtDOM.dropClass(fdjtDOM.$(".sourced",results_div),"sourced");
	    return;}
	selectSourcesRecur(results_div,sources);
	if (sbook.target) scrollGlosses(sbook.target,results_div);}
    sbook.UI.selectSources=selectSources;

    /* Scrolling slices */

    function scrollGlosses(elt,glosses,top){
	if (!(elt.id)) elt=getFirstID(elt);
	var info=sbook.docinfo[elt.id];
	var targetloc=((info)&&(info.starts_at))||(elt.starts_at);
	if (targetloc) {
	    var scrollto=getFirstElt(glosses,targetloc);
	    if ((scrollto)&&((top)||(!(fdjtDOM.isVisible(scrollto))))) {
		if ((sbook.scrollers)&&(glosses.id)&&
		    (sbook.scrollers[glosses.id])) {
		    var scroller=sbook.scrollers[glosses.id];
		    scroller.scrollToElement(scrollto);}
		else scrollto.scrollIntoView(true);}}}
    sbook.UI.scrollGlosses=scrollGlosses;
    
    function getFirstID(node){
	if (node.id) return node;
	else if (node.childNodes) {
	    var children=node.childNodes;
	    var i=0; var lim=children.length;
	    while (i<lim) {
		var child=children[i++];
		if (child.nodeType===1) {
		    var found=getFirstID(child);
		    if (found) return found;}}
	    return false;}
	else return false;}

    function getFirstElt(glosses,location){
	var children=glosses.childNodes; var last=false;
	var i=0; var lim=children.length;
	while (i<lim) {
	    var child=children[i++];
	    if (child.nodeType!==1) continue;
	    else if (!(child.starts)) continue;
	    else if (child.starts===location)
		return child;
	    else if (child.starts>location) {
		if (last)
		    return getFirstElt(last,location)||last;
		else return last;}
	    else last=child;}
	if (last) getFirstElt(last,location);
	return false;}
    
    function getScrollOffset(elt,inside){
	if (elt.parentNode===inside) {
	    var children=inside.childNodes;
	    var i=0; var lim=children.length; var off=0;
	    while (i<lim) {
		var child=children[i++];
		if (child===elt) return off;
		if (child.offsetHeight) off=off+child.offsetHeight;}
	    return off;}
	else return getScrollOffset(elt,elt.parentNode)+
	    getScrollOffset(elt.parentNode,inside);}

    /* Results handlers */

    function setupSummaryDiv(div){
	sbook.UI.addHandlers(div,'summary');}
    sbook.UI.setupSummaryDiv=setupSummaryDiv;
    
})();
/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
