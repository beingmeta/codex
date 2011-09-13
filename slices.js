/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

var codex_slices_id="$Id$";
var codex_slices_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009-2011 beingmeta, inc.
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

var sbook_details_icon="detailsicon16x16.png";
var sbook_outlink_icon="outlink16x16.png";
var sbook_small_remark_icon="remarkballoon16x13.png";
var sbook_delete_icon_touch="redx24x24.png";
var sbook_delete_icon="redx16x16.png";
var sbook_edit_icon_touch="remarkedit32x25.png";
var sbook_edit_icon="remarkedit20x16.png";
var sbook_reply_icon_touch="replyballoons41x24.png";
var sbook_reply_icon="replyballoons26x15.png";

(function () {

    var div_threshold=7;
    var debug_locbars=false;
    var odq="\u201c"; var cdq="\u201d";

    function renderNote(info,query,idprefix,standalone){
	var key=info._id;
	var target_id=(info.frag)||(info.id);
	var target=((target_id)&&(fdjtID(target_id)));
	var target_info=Codex.docinfo[target_id];
	var head_info=target_info.head;
	var head=((head_info)&&(head_info.elt));
	var refiners=((query) && (query._refiners));
	var score=((query)&&(query[key]));
	var body=
	    fdjtDOM("div.codexnotebody",
		    // (makelocrule(target_info,target_info.head)),
		    ((!(standalone))&&(info.maker)&&(showglossinfo(info)))," ",
		    ((standalone)&&(showtocloc(target_info))),
		    ((score)&&(showscore(score))),
		    ((info.note)&&(fdjtDOM("span.note",info.note)))," ",
		    ((info.audience)&&(info.audience.length)&&
		     (info.audience.length<div_threshold)&&
		     (showaudience(info.audience)))," ",
		    ((info.excerpt)&&(showexcerpts(info.excerpt)))," ",
		    ((info.links)&&(showlinks(info.links,"span.link")))," ",
		    ((info.attachments)&&
		     (showlinks(info.attachments,"span.attachments")))," ",
		    ((info.audience)&&(info.audience.length)&&
		     (info.audience.length>=div_threshold)&&
		     (showaudience(info.audience))),
		    (((info.tags)||(info.autotags))&&(showtags(info))));
	var div=
	    fdjtDOM(((info.maker) ? "div.codexnote.gloss" : "div.codexnote"),
		    ((head)&&(makeTOCHead(head))),
		    ((head_info)&&(makeIDHead(target,head_info,true))),
		    ((standalone)&&(makelocbar(target_info))),
		    body);
	var makerinfo=((info.maker)&&(fdjtKB.ref(info.maker)));
	var tstamp=info.tstamp||info.modified||info.created;
	if (tstamp)
	    body.title="gloss from "+makerinfo.name+" at "+fdjtTime.shortString(tstamp);
	else div.title=Codex.getTitle(target,true);
	div.about="#"+info.frag;
	// div.setAttribute('about',"#"+info.id);
	if (idprefix) div.id=idprefix+info.id;
	if (info._id) {
	    div.name=div.qref=info._id;
	    div.setAttribute("name",info._id);}
	return div;}
    Codex.renderNote=renderNote;
    
    var prime_thresh=7;
    function getprimetags(info){
	if (info.primetags) return info.primetags;
	var tags=info.tags;
	if (typeof tags==='string') tags=[tags];
	if (tags.length<=prime_thresh) return tags;
	var tagscores=Codex.index.tagweights;
	var prime=[].concat(info.tags);
	prime.sort(function(t1,t2){
	    var s1=tagscores[t1]; var s2=tagscores[t2];
	    if ((s1)&&(s2)) {
		if (s1<s2) return -1;
		else if (s1>s2) return 1;
		else return 0;}
	    else if (s1) return -1;
	    else if (s3) return 1;
	    else return 0;});
	info.primetags=prime.slice(0,prime_thresh);
	return info.primetags;}

    var show_tag_thresh=7;

    var expander_toggle=fdjtUI.Expansion.toggle;
    function tagexpand_click(evt){
	return expander_toggle(evt);}

    var combineTags=Knodule.combineTags;
    
    function showtags(info){
	var ctags=info.tags;
	var gtags=info.glosstags;
	var atags=info.autotags;
	var tags; var scores;
	if ((typeof ctags === 'string')||(ctags instanceof String))
	    ctags=[ctags];
	if (!((atags)||(gtags))) {
	    tags=ctags; scores=tags.scores;}
	else if (info.alltags) {
	    // This is where the combination of tags is cached
	    tags=info.alltags; scores=tags.scores;}
	else {
	    // Sort the automatic tags if needed
	    if ((atags)&&(!(atags.sorted))) {
		var weights=Codex.index.tagweights;
		atags.sort(function(t1,t2){
		    var v1=weights[t1], v2=weights[t2];
		    if ((v1)&&(v2)) {
			if (v1<v2) return -1;
			else if (v1>v2) return 1;
			else return 0;}
		    else if (v1) return 1;
		    else return -1;});
		atags.sorted=true;}
	    tags=info.alltags=combineTags([ctags,gtags,atags]);
	    scores=tags.scores;}
	var tagcount=0;
	var countspan=fdjtDOM("span.count");
	var tagicon=fdjtDOM.Image
	(cxicon("TagIcon16x16.png"),"img.tagicon","tags");
	var span=fdjtDOM("span.tags.fdjtexpands",tagicon);
	var tagspan=span;
	var controller=false;
	var i=0; var lim=tags.length;
	while (i<tags.length) {
	    var tag=tags[i]; var score=((scores)&&(scores[tag]))||false;
	    if ((typeof tag === 'string')&&(tag.indexOf('@')>=0))
		tag=fdjtKB.ref(tag)||tag;
	    var togo=tags.length-i;
	    if ((!controller)&&((!(score))||(score<=1))&&
		(i>show_tag_thresh)&&(togo>4)) {
		controller=fdjtDOM("span.controller",
				   "all ",tags.length," tags",
				   fdjtDOM("span.whenexpanded","-"),
				   fdjtDOM("span.whencollapsed","+"));
		var subspan=fdjtDOM("span.whenexpanded");
		controller.onclick=tagexpand_click;
		fdjtDOM(span," ",controller," ",subspan);
		tagspan=subspan;}
	    fdjtDOM.append(tagspan,((i>0)?" \u00b7 ":" "),Knodule.HTML(tag));
	    i++;}
	return span;}
    function showaudience(tags){
	if (!(tags instanceof Array)) tags=[tags];
	var span=fdjtDOM(
	    ((tags.length>=div_threshold)?"div.audience":"span.audience"),
	    ((tags.length>=div_threshold)&&
	     (fdjtDOM("span.count",tags.length, " outlets"))));
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
	    if (url[0]==='_') continue;
	    var urlinfo=refs[url];
	    var title; var icon=sbicon("outlink16x8.png");
	    if (typeof urlinfo === 'string') title=urlinfo;
	    else {
		title=urlinfo.title;
		icon=urlinfo.icon;}
	    var image=fdjtDOM.Image(icon);
	    var anchor=(fdjtDOM.Anchor(url,{title:url},title,image));
	    anchor.target='_blank';
	    fdjtDOM(span,anchor,"\n");}
	return span;}
    function showexcerpts(excerpts){
	if (typeof excerpts==='string')
	    return fdjtDOM("span.excerpt",odq,excerpts,cdq);
	else {
	    var espan=fdjtDOM("div.excerpts");
	    var i=0; var lim=excerpts.length;
	    while (i<lim)
		fdjtDOM(espan,
			((i>0)&&" "),
			fdjtDOM("span.excerpt",odq,excerpts[i++],cdq));
	    return espan;}}
    function showscore(score){
	var scorespan=fdjtDOM("span.score");
	var score=query[key]; var k=0;
	while (k<score) {fdjtDOM(scorespan,"*"); k++;}
	return scorespan;}
    function showglossinfo(info) {
	var user=info.maker;
	var feed=info.feed||false;
	var userinfo=Codex.sourcekb.map[user];
	var feedinfo=Codex.sourcekb.map[feed];
	var agestring=timestring(info.modified||info.created);
	var age=fdjtDOM("span.age",agestring);
	age.title=(((user===Codex.user)||(user===Codex.user._id))?
		   ("edit this gloss"):
		   ("relay/reply to this gloss"));
	// This should be made to work
	// age.onclick=relayoredit_gloss;
	var deleteicon=
	    // No delete icons for the ipad right now (too small)
	    ((user===Codex.user.oid)&&
	     (fdjtDOM(
		 "span",
		 (fdjtDOM.Image(sbicon(sbook_delete_icon),
				"img.delete.button.mouseicon","x",
				"delete this gloss")),
		 (fdjtDOM.Image(sbicon(sbook_delete_icon_touch),
				"img.delete.button.touchicon","x",
				"delete this gloss")))));
	if (deleteicon) deleteicon.onclick=deletegloss_ontap;
	var editicon=
	    ((user===Codex.user.oid)&&
	     (fdjtDOM(
		 "span",
		 (fdjtDOM.Image(
		     sbicon(sbook_edit_icon),"img.edit.button.mouseicon","!",
		     "edit this gloss")),
		 (fdjtDOM.Image(
		     sbicon(sbook_edit_icon_touch),
		     "img.edit.button.touchicon","!",
		     "edit this gloss")))));
	if (editicon) editicon.onclick=editicon_ontap;
	var replyicon=
	    fdjtDOM(
		"span",
		(fdjtDOM.Image(cxicon(sbook_reply_icon),
			       "img.reply.button.mouseicon","++",
			       "respond to this gloss")),
		(fdjtDOM.Image(cxicon(sbook_reply_icon_touch),
			       "img.reply.button.touchicon","++",
			       "respond to this gloss")));
	replyicon.onclick=replyicon_ontap;
	var picinfo=getpicinfo(info);
	var overdoc=getoverdoc(info);
	
	return [(fdjtDOM("span.glossinfo",deleteicon,editicon,replyicon)),
		((picinfo)?
		 (fdjtDOM.Image(picinfo.src,picinfo.classname,picinfo.alt)):
		 (getfakepic(info.maker,"div.sourcepic"))),
		((overdoc)&&(overdoc.name)&&
		 (fdjtDOM("span.overdoc",(overdoc.name)))),
		((overdoc)&&(overdoc.name)&&(" \u00b7 ")),
		(((!(overdoc))&&(userinfo)&&
		  ((userinfo.name)||(userinfo.userid)))&&
		 (fdjtDOM("span.user",((userinfo.name)||(userinfo.userid))))),
		((!(overdoc))&&(userinfo)&&
		 ((userinfo.name)||(userinfo.userid))&&
		 (" \u2014 ")),
		age];}

    function getoverdoc(info){
	if (info.sources) {
	    var sources=info.sources;
	    var i=0; var lim=sources.length;
	    while (i<lim) {
		var source=fdjtKB.ref(sources[i++]);
		if ((source)&&(source.kind===':OVERDOC'))
		    return source;}
	    return false;}
	else return false;}

    function getfakepic(maker,spec){
	var userinfo=fdjtKB.ref(maker);
	var pic=fdjtDOM(spec||"div.sbooksourcepic",
			fdjtString.getInitials(userinfo.name));
	return pic;}

    function getpicinfo(info){
	if (info.pic) return {src: info.pic,alt: info.pic};
	else if (info.sources) {
	    var sources=info.sources;
	    if (typeof sources==='string') sources=[sources];
	    var i=0; var lim=sources.length;
	    while (i<lim) {
		var source=fdjtKB.ref(sources[i++]);
		if ((source)&&(source.kind===':OVERDOC')&&(source.pic))
		    return { src: source.pic, alt: source.name,
			     classname: "sourcepic"};}}
	if (info.maker) {
	    var userinfo=fdjtKB.ref(info.maker);
	    if (userinfo.pic)
		return { src: userinfo.pic, alt: userinfo.name,
			 classname: "userpic"};
	    else if (userinfo.fbid)
		return {
		    src: "https://graph.facebook.com/"+
			userinfo.fbid+"/picture?type=square",
		    classname: "userpic fbpic"};
	    else return false;}
	else return false;}

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
	if (!(cxt_info)) cxt_info=Codex.docinfo[document.body.id];
	var cxt_start=cxt_info.starts_at;
	var cxt_end=cxt_info.ends_at;
	var cxt_len=cxt_end-cxt_start;
	if (debug_locbars)
	    locbar.setAttribute(
		"debug","ts="+target_start+"; te="+target_end+"; cl="+cxt_len);
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
	    "javascript:Codex.JumpTo('"+(head.frag||head.id)+"');","a.headref",
	    fdjtDOM("span.spacer","\u00A7"),
	    head.title);
	var title="jump to "+head.title;
	var i=heads.length-1; 
	while (i>0) {
	    var head=heads[i--]; title=title+"// "+head.title;}
	anchor.title=title;
	return [" ",anchor];}

    function makelocspan(target_info,cxtinfo){
	if (!(cxtinfo)) cxtinfo=Codex.docinfo[(Codex.body||document.body).id];
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
    function makelocrule(target_info,cxtinfo,spec){
	if (!(cxtinfo)) cxtinfo=Codex.docinfo[(Codex.body||document.body).id];
	var locrule=fdjtDOM(spec||"hr.locrule");
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

    function deletegloss_ontap(evt){
	var scan=fdjtUI.T(evt);
	fdjtUI.cancel(evt);
	while (scan) {
	    if (scan.qref) break;
	    else scan=scan.parentNode;}
	if (!(scan)) return;
	var qref=scan.qref;
	var frag=Codex.glosses.ref(qref).get("frag");
	if (scan)
	    fdjtAjax.jsonCall(
		function(response){deletegloss(response,qref,frag);},
		"https://"+Codex.server+"/glosses/delete",
		"gloss",scan.qref);}
    function deletegloss(response,glossid,frag){
	if (response===glossid) {
	    Codex.glosses.drop(glossid);
	    Codex.allglosses=fdjtKB.remove(Codex.allglosses,glossid);
	    if (Codex.offline)
		fdjtState.setLocal("glosses("+Codex.refuri+")",
				   Codex.allglosses,true);
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
    
    function editicon_ontap(evt){
	var target=fdjtUI.T(evt);
	var note=fdjtDOM.getParent(target,'.codexnote');
	var gloss=((note)&&(note.name)&&(fdjtKB.ref(note.name)));
	Codex.setGlossTarget(gloss);
	CodexMode("addgloss");}
    function replyicon_ontap(evt){
	var target=fdjtUI.T(evt);
	var note=fdjtDOM.getParent(target,'.codexnote');
	var gloss=((note)&&(note.name)&&(fdjtKB.ref(note.name)));
	Codex.setGlossTarget(gloss);
	CodexMode("addgloss");}

    function relayoredit_gloss(evt){
	var scan=fdjtUI.T(evt);
	fdjtUI.cancel(evt);
	while (scan) {
	    if (scan.qref) break;
	    else scan=scan.parentNode;}
	if (!(scan)) return;
	var qref=scan.qref;
	var gloss=Codex.glosses.ref(qref);
	var frag=gloss.get("frag");
	Codex.setGlossTarget(gloss);
	CodexMode("addgloss");}

    function sourceIcon(info){
	if (info) return info.pic;}
    
    function sbicon(name,suffix) {return Codex.graphics+name+(suffix||"");}
    function cxicon(name,suffix) {
	return Codex.graphics+"codex/"+name+(suffix||"");}

    // Displayings sets of notes organized into threads

    function sortbyloctime(x,y){
	if (x.frag===y.frag) {
	    if ((x.tstamp)&&(y.tstamp)) {
		if (x.tstamp<y.tstamp) return -1;
		else if (x.tstamp>y.tstamp) return 1;
		else return 0;}
	    else if (x.tstamp) return 1;
	    else if (y.tstamp) return -1;
	    else return 0;}
	else if (x.ends_at<=y.starts_at) return 1;
	else if (x.starts_at>=y.ends_at) return -1;
	else if ((x.ends_at-x.starts_at)>(y.ends_at-y.starts_at))
	    return 1;
	else return -1;}

    function showSlice(results,div,scores,sort){
	var notes=new Array(results.length);
	var i=0; var lim=results.length;
	while (i<lim) {
	    var r=results[i];
	    if (typeof r === 'string') {
		var ref=Codex.docinfo[r]||Codex.glosses.ref(r);
		if (!(ref)) fdjtLog("No resolution for %o",r);
		notes[i]=ref;}
	    else notes[i]=r;
	    i++;}
	if (!(sort)) {}
	else if (scores)
	    notes.sort(function(n1,n2){
		var s1=(scores[n1._id]);
		var s2=(scores[n2._id]);
		if ((s1)&&(s2)) {
		    if (s1>s2) return -1;
		    else if (s2>s1) return 1;}
		else if (s1) return -1;
		else if (s2) return 1;
		if (n1.starts_at<n2.starts_at) return -1;
		else if (n1.starts_at>n2.starts_at) return 1;
		else if (n1.ends_at<n2.ends_at) return -1;
		else if (n1.ends_at>n2.ends_at) return 1;
		else if ((n1.tstamp)&&(n2.tstamp)) {
		    if (n1.tstamp>n2.tstamp) return -1;
		    else if (n1.tstamp>n2.tstamp) return 1;
		    else return 0;}
		else if (n1.tstamp) return 1;
		else if (n2.tstamp) return -1;
		else return 0;});
	else notes.sort(function(n1,n2){
	    if (n1.starts_at<n2.starts_at) return 1;
	    else if (n1.starts_at>n2.starts_at) return -1;
	    else if (n1.ends_at<n2.ends_at) return 1;
	    else if (n1.ends_at>n2.ends_at) return -1;
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
	    var docinfo=Codex.docinfo[target.id];
	    var headinfo=docinfo.head;
	    var head=document.getElementById(headinfo.frag);
	    // var tochead=makeTOCHead(head);
	    if (curinfo!==docinfo) {
		if (headinfo!==curhead) {
		    headelt=fdjtDOM("div.codexthread.tocthread"); // ,tochead
		    headelt.frag=headinfo.frag;
		    fdjtDOM.append(div,headelt);
		    curhead=headinfo;}
		threadelt=fdjtDOM("div.codexthread.idthread");
		// ,makeIDHead(target,headinfo,true)
		threadelt.about="#"+frag;
		threadelt.title=Codex.getTitle(target,true);
		fdjtDOM.append(headelt,threadelt);
		curinfo=docinfo;}
	    fdjtDOM.append(threadelt,renderNote(note));}
	return div;}
    Codex.UI.showSlice=showSlice;

    function sumText(target){
	var title=Codex.getTitle(target,true);
	if (title.length<40) return title;
	/* title.slice(0,40)+"\u22ef "; */
	else return title;}
    
    function makeTOCHead(target,head){
	if (!(head)) head=Codex.getHead(target);
	var basespan=fdjtDOM("span");
	basespan.title='this location in the structure of the book';
	var title=Codex.getTitle(target,true);
	var info=Codex.docinfo[target.id];
	var head_info=Codex.docinfo[head.id];
	if (target!==head) {
	    var paratext=
		fdjtDOM.Anchor("javascript:Codex.JumpTo('"+target.id+"');",
			       "a.paratext",
			       fdjtDOM("span.spacer","\u00B6"),
			       sumText(target));
	    paratext.title='(click to jump to this passage) '+title;
	    fdjtDOM(basespan,paratext," ");}
	if (head) {
	    var text=sumText(head);
	    var headtext=
		fdjtDOM.Anchor("javascript:Codex.JumpTo('"+head.id+"');",
			       "a.headtext",
			       fdjtDOM("span.spacer","\u00A7"),
			       text);
	    var curspan=fdjtDOM("span.head",headtext);
	    headtext.title='jump to the section: '+text;
	    fdjtDOM.append(basespan," ",curspan);
	    var heads=Codex.Info(head).heads;
	    if (heads) {
		var j=heads.length-1; while (j>=0) {
		    var hinfo=heads[j--]; var elt=fdjtID(hinfo.frag);
		    if ((!(elt))||(!(hinfo.title))||
			(elt===Codex.root)||(elt===document.body))
			continue;
		    var anchor=
			fdjtDOM.Anchor(
			    "javascript:Codex.JumpTo('"+hinfo.frag+"');",
			    "a.headtext",
			    fdjtDOM("span.spacer","\u00A7"),
			    hinfo.title);
		    var newspan=fdjtDOM("span.head"," ",anchor);
		    anchor.title=
			((hinfo.title)?('jump to the section: '+hinfo.title):
			 "(jump to this section)");
		    if (target===head) fdjtDOM(curspan,newspan);
		    else fdjtDOM(curspan," \u22ef ",newspan);
		    curspan=newspan;}}}
	var tochead=fdjtDOM("div.tochead",
			    makelocrule(info,false),
			    basespan);
	return tochead;}

    function makeIDHead(target,headinfo,locrule){
	var info=Codex.docinfo[target.id];
	var headinfo=info.head;
	var tochead=fdjtDOM("div.idhead",
			    makelocrule(info,headinfo),
			    fdjtDOM("span.spacer","\u00b6"),
			    fdjtDOM("span",sumText(target)));
	var title=Codex.getTitle(target,true);
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
	var eltinfo=Codex.docinfo[frag];
	var about=document.getElementById(frag);
	var headinfo=((eltinfo.toclevel)?(eltinfo):(eltinfo.head));
	var headid=headinfo.frag;
	var head=document.getElementById(headid);
	var starts=eltinfo.starts_at;
	var head_starts=headinfo.starts_at;
	var insertion=false; var insdiff=0;
	var headthread=findTOCref(div,headid,head_starts);
	if ((!(headthread))||(headthread.tocref!==headid)) {
	    var insertbefore=headthread;
	    headthread=fdjtDOM("div.codexthread.tocthread");
	    // ,makeTOCHead(head,head)
	    headthread.tocref=headid; headthread.starts=head_starts;
	    if (insertbefore) fdjtDOM.insertBefore(insertbefore,headthread);
	    else fdjtDOM.append(div,headthread);}
	var idthread=((frag===headid)?(headthread):
		      (findTOCref(headthread,frag,starts)));
	if ((!(idthread))||(idthread.tocref!==frag)) {
	    var insertbefore=idthread;
	    idthread=fdjtDOM("div.codexthread.idthread");
	    idthread.tocref=frag; idthread.starts=starts; idthread.about="#"+frag;
	    idthread.title=Codex.getTitle(about,true);
	    idthread.setAttribute("locref",frag);
	    idthread.setAttribute("locinfo",starts);
	    if (insertbefore) fdjtDOM.insertBefore(insertbefore,idthread);
	    else fdjtDOM.append(headthread,idthread);}
	var tstamp=note.tstamp; var qid=note._id;
	var children=headthread.childNodes;
	var ishead=(frag===headid);
	var i=0; var lim=children.length;
	while (i<lim) {
	    var child=children[i++];
	    if (child.nodeType!==1) continue;
	    if ((ishead)&&(fdjtDOM.hasClass(child,"codexthread"))) {
		fdjtDOM.insertBefore(child,renderNote(note));
		return;}
	    // If unrelated, continue
	    if (!((fdjtDOM.hasClass(child,"codexnote"))||
		  (fdjtDOM.hasClass(child,"codexthread"))))
		continue;
	    // If the same thing, replace
	    if (child.qref===qid) {
		fdjtDOM.replace(child,renderNote(note));
		return;}
	    // if you're earlier, insert yourself and return
	    if (tstamp<=child.tstamp) {
		fdjtDOM.insertBefore(child,renderNote(note));
		return;}
	    else continue;}
	fdjtDOM.append(idthread,renderNote(note));}
    Codex.UI.addToSlice=addToSlice;

    Codex.nextSlice=function(start){
	var slice=fdjtDOM.getParent(start,".codexslice");
	var scan=fdjtDOM.forwardElt(start); var ref=false;
	while (scan) {
	    if (((scan.about)||
		 ((scan.getAttribute)&&(scan.getAttribute("about"))))&&
		((fdjtDOM.hasClass(scan,"codexnote"))||
		 (fdjtDOM.hasClass(scan,"passage"))))
		break;
	    else scan=fdjtDOM.forwardElt(scan);}
	if (fdjtDOM.hasParent(scan,slice)) return scan;
	else return false;};
    Codex.prevSlice=function(start){
	var slice=fdjtDOM.getParent(start,".codexslice");
	var scan=fdjtDOM.backwardElt(start); var ref=false;
	while (scan) {
	    if (((scan.about)||
		 ((scan.getAttribute)&&(scan.getAttribute("about"))))&&
		((fdjtDOM.hasClass(scan,"codexnote"))||
		 (fdjtDOM.hasClass(scan,"passage"))))
		break;
	    else scan=fdjtDOM.backwardElt(scan);}
	if (fdjtDOM.hasParent(scan,slice)) return scan;
	else return false;};

    /* Selecting a subset of glosses to display */

    var hasClass=fdjtDOM.hasClass;

    function selectSourcesRecur(thread,sources){
	var empty=true; var children=thread.childNodes;
	var i=0; var lim=children.length;
	while (i<children.length) {
	    var child=children[i++];
	    if (child.nodeType!==1) continue;
	    if (hasClass(child,"codexnote")) {
		var gloss=(child.qref)&&Codex.glosses.map[child.qref];
		if (!(gloss)) fdjtDOM.dropClass(child,"sourced");
		else if ((fdjtKB.contains(sources,gloss.maker))||
			 (fdjtKB.overlaps(sources,gloss.sources))) {
		    fdjtDOM.addClass(child,"sourced");
		    empty=false;}
		else fdjtDOM.dropClass(child,"sourced");}
	    else if (hasClass(child,"codexthread")) {
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
	if (Codex.target) scrollGlosses(Codex.target,results_div);}
    Codex.UI.selectSources=selectSources;

    /* Scrolling slices */

    function scrollGlosses(elt,glosses,top){
	if (!(elt.id)) elt=getFirstID(elt);
	var info=Codex.docinfo[elt.id];
	var targetloc=((info)&&(info.starts_at))||(elt.starts_at);
	if (targetloc) {
	    var scrollto=getFirstElt(glosses,targetloc);
	    if ((scrollto)&&((top)||(!(fdjtDOM.isVisible(scrollto))))) {
		if ((Codex.scrollers)&&(glosses.id)&&
		    (Codex.scrollers[glosses.id])) {
		    var scroller=Codex.scrollers[glosses.id];
		    scroller.scrollToElement(scrollto);}
		else scrollto.scrollIntoView(true);}}}
    Codex.UI.scrollGlosses=scrollGlosses;
    
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
	Codex.UI.addHandlers(div,'summary');}
    Codex.UI.setupSummaryDiv=setupSummaryDiv;
    
})();

fdjt_versions.decl("codex",codex_slices_version);
fdjt_versions.decl("codex/slices",codex_slices_version);

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
