/* -*- Mode: Javascript; -*- */

var sbooks_gloss_id="$Id: notes.js 5410 2010-07-31 12:28:42Z haase $";
var sbooks_gloss_version=parseInt("$Revision: 5410 $".slice(10,-1));

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

(function () {

    function sbicon(base){return sbook.graphics+base;}

    function glossTarget(passage,refresh) {
	if ((sbook.glosstart)&&(!(refresh))&&
	    (passage===sbook.glosstarget))
	    return false;
	sbook.setTarget(passage);
	sbook.setGlossTarget(passage);
	sbook.setInfoTarget(passage);
	sbook.glosstarget=passage;
	return passage;}
    sbook.glossTarget=glossTarget;

    var objectkey=fdjtKB.objectkey;

    function glossBlock(id,spec,xfeatures,glosses,expansive){
	var docinfo=sbook.docinfo[id];
	var all=xfeatures||[]; var freq={}; var notes={}; var links={};
	if (!(glosses)) glosses=sbook.glosses.find('frag',id);
	var i=0; var lim=glosses.length;
	while (i<lim) {
	    var gloss=glosses[i++]; var glossid;
	    if (typeof gloss === 'string') {
		glossid=gloss; gloss=sbook.glosses.ref(glossid);}
	    else glossid=gloss.qid;
	    var user=gloss.user;
	    var sources=gloss.distribution;
	    var tags=gloss.tags;
	    if ((sources)&&(!(sources instanceof Array))) sources=[sources];
	    if ((tags)&&(!(tags instanceof Array))) tags=[tags];
	    if (freq[user]) freq[user]++;
	    else {freq[user]=1; all.push(user);}
	    if (gloss.note) {
		if (notes[user]) fdjtKB.add(notes,user,glossid,true);
		else notes[user]=[glossid];}
	    if (gloss.href) {
		if (links[user]) fdjtKB.add(links,user,glossid,true);
		else links[user]=[glossid];}
	    if (sources) {
		var j=0; var jlim=sources.length;
		while (j<jlim) {
		    var source=sources[j++];
		    if (freq[source]) freq[source]++;
		    else {freq[source]=1; all.push(source);}
		    if (gloss.note) {
			if (notes[source])
			    fdjtKB.add(notes,source,glossid,true);
			else notes[source]=[glossid];}
		    if (gloss.href) {
			if (links[source])
			    fdjtKB.add(links,source,glossid,true);
			else links[source]=[glossid];}}}
	    if (tags) {
		var j=0; var jlim=tags.length;
		while (j<jlim) {
		    var tag=tags[j++];
		    if (typeof tag === 'object') tag=objectkey(tag);
		    if (freq[tag]) freq[tag]++;
		    else {freq[tag]=1; all.push(tag);}}}}
	var tags=docinfo.tags;
	if ((tags)&&(!(tags instanceof Array))) tags=[tags];
	if (tags) {
	    var i=0; var lim=tags.length;
	    while (i<lim) {
		var tag=tags[i++];
		if (typeof tag === 'object') tag=objectkey(tag);
		if (freq[tag]) freq[tag]++;
		else {freq[tag]=1; all.push(tag);}}}
	var info=fdjtDOM
	(spec||"div.sbookinfo",
	 (fdjtDOM.Image(sbicon("YellowPlus32x32.png"),
			"img.expandbutton","+","click to see more")));
	var i=0; var lim=all.length;
	while (i<lim) {
	    var tag=all[i]; var span=false;
	    var taginfo=fdjtKB.ref(tag);
	    if ((taginfo)&&(taginfo.kind)) {
		span=fdjtDOM("span.source",taginfo.name||tag);
		if (links[tag]) {
		    var sg=links[tag];
		    var icon=fdjtDOM.Image(sbicon("DiagLink16x16.png"));
		    if (sg.length===1) {
			var gloss=sbook.glosses.ref(sg[0]);
			var anchor=fdjtDOM.Anchor(gloss.href,"a",icon);
			anchor.title=gloss.note;
			fdjtDOM(span," ",anchor);}
		    else fdjtDOM(span," ",icon,sg.length);}
		if (notes[tag]) {
		    var sg=notes[tag];
		    var icon=fdjtDOM.Image(sbicon("remarkballoon16x13.png"));
		    if (sg.length===1) {
			var gloss=sbook.glosses.ref(sg[0]);
			icon.title=gloss.note; fdjtDOM(span," ",icon);}
		    else fdjtDOM(span," ",icon,sg.length);}}
	    else span=fdjtDOM("span.tag",taginfo||tag);
	    span.setAttribute("tag",(((taginfo)&&(taginfo.qid))||tag));
	    fdjtDOM(info,((i>0)&&(" \u00b7 ")),span);
	    i++;}
	var i=0; var lim=glosses.length;
	while (i<lim) {
	    var gloss=glosses[i++]; var glossid;
	    if (typeof gloss === 'string') {
		glossid=gloss; gloss=sbook.glosses.ref(glossid);}
	    else glossid=gloss.qid;
	    var msgelt=false;
	    if ((gloss.note)&&(gloss.href)) 
		msgelt=fdjtDOM.Anchor(gloss.href,"a.note",gloss.note);
	    else if (gloss.note) {
		msgelt=fdjtDOM("span.note",gloss.note);}
	    else if (gloss.href) {
		var user=sbook.sourcekb.ref(gloss.user);
		msgelt=fdjtDOM.Anchor(
		    gloss.href,"a.note",
		    fdjtDOM.Image(sbicon("DiagLink16x16.png")),
		    ((user)&&(user.name)));}
	    else {}
	    var user=sbook.sourcekb.ref(gloss.user); var title="";
	    var sources=gloss.sources;
	    var tstamp=gloss.tstamp;
	    var note=gloss.note;
	    var tags=gloss.tags;
	    if ((tags)&&(!(tags instanceof Array))) tags=[tags];
	    if ((sources)&&(!(sources instanceof Array))) sources=[sources];
	    var glosselt;
	    if (!((note)||((tags)&&(tags.length))||
		  ((sources)&&(sources.length>1))))
		continue;
	    if (expansive) {
		glosselt=fdjtDOM("div.gloss",
				 ((user)&&(user.pic)&&
				  (fdjtDOM.Image
				   (user.pic,"img.userpic",user.name))),
				 ((tstamp)&&(tstamp>0)&&
				  (fdjtDOM("span.tstamp",
					   fdjtTime.tick2shortstring(tstamp)))),
				 msgelt);
		if ((tags)&&(tags.length)) {
		    var tagspan=fdjtDOM("span.tags"," // ");
		    var j=0; var jlim=tags.length;
		    while (j<jlim) {
			fdjtDOM(tagspan,fdjtDOM
				("span.tag",((j>0)&&("\u00b6")),tags[j]));
			j++;}
		    fdjtDOM(glosselt,tagspan);}
		if (sources) {
		    var sourcespan=fdjtDOM("span.sources");
		    var j=0; var jlim=sources.length;  var first=false;
		    while (j<jlim) {
			var source=sources[j++];
			if (source===user) continue;
			if (first) fdjtDOM(sourcespan," \u00b7 ");
			else {
			    first=source;
			    fdjtDOM(sourcespan," // ");}
			var srcspan=
			    fdjtDOM("span.source",sbook.sourcekb.ref(source));
			srcspan.setAttribute("source",source);
			fdjtDOM(sourcespan,srcspan);}
		    if (first)
			title=title+"/"+sbook.sourcekb.ref(source).name;}}
	    else glosselt=msgelt;
	    if (user) title=title+"/"+user.name;
	    if (tstamp) title=title+"/"+fdjtTime.tick2string(tstamp);
	    if (title.length) glosselt.title=title;
	    fdjtDOM(info,fdjtDOM("span.glosspace","\n\u00b7 "),glosselt);}
	info.onclick=sbookinfo_onclick;
	return info;}
    sbook.glossBlock=glossBlock;

    function sbookinfo_onclick(evt){
	var target=fdjtUI.T(evt);
	var parent=false;
	if (fdjtDOM.hasParent(target,".expandbutton")) {
	    var sbookinfo=fdjtDOM.getParent(target,".sbookinfo");
	    fdjtDOM.toggleClass(sbookinfo,"expanded");}
	else while (target) {
	    if (!(target.getAttribute)) target=target.parentNode;
	    else if (target.getAttribute("tag"))
		return sbook.startSearch(target.getAttribute("tag"));
	    else if (target.getAttribute("source"))
		return sbook.startSearch(target.getAttribute("source"));
	    else target=target.parentNode;}
	fdjtUI.cancel(evt);}

    sbook.setInfoTarget=function(passage){
	var infodiv=sbook.glossBlock(passage.id,"div.sbookinfo.hudblock")
	fdjtDOM.replace("SBOOKINFO",infodiv);}

    function addTag(form,tag) {
      // fdjtLog("[%fs] Adding %o to tags for %o",fdjtET(),tag,form);
      if (!(tag)) tag=form;
      if (form.tagName!=='FORM')
	form=fdjtDOM.getParent(form,'form')||form;
      var tagselt=fdjtDOM.getChild(form,'.tags');
      var varname='TAGS'; var info; var title=false;
      if ((tag.nodeType)&&(fdjtDOM.hasClass(tag,'completion'))) {
	if (fdjtDOM.hasClass(tag,'outlet'))
	  varname='OUTLETS';
	else if (fdjtDOM.hasClass(tag,'source'))
	  varname='ATTENTION'
	  else {}
	if (tag.title) title=tag.title;
	tag=gloss_cloud.getValue(tag);}
      var info=
	((typeof tag === 'string')&&
	 ((tag.indexOf('|')>0)?
	  (sbook.knodule.handleSubjectEntry(tag)):
	  (fdjtKB.ref(tag)||sbook.knodule.probe(tag))));
      var text=((info)?
		((info.toHTML)&&(info.toHTML())||info.name||info.dterm):
		(tag));
      if (info) {
	if (info.knodule===sbook.knodule)
	  tag=info.dterm;
	else tag=info.qid||info.oid||info.dterm||tag;}
      if ((info)&&(info.pool===sbook.sourcekb)) varname='OUTLETS';
      var checkspans=fdjtDOM.getChildren(tagselt,".checkspan");
      var i=0; var lim=checkspans.length;
      while (i<lim) {
	var cspan=checkspans[i++];
	if (((cspan.getAttribute("varname"))===varname)&&
	    ((cspan.getAttribute("tagval"))===tag))
	  return cspan;}
      var span=fdjtUI.CheckSpan("span.checkspan",varname,tag,true);
      if (title) span.title=title;
      span.setAttribute("varname",varname);
      span.setAttribute("tagval",tag);
      fdjtDOM.addClass(span,varname.toLowerCase());
      if (typeof text === 'string')
	fdjtDOM.append(span,fdjtDOM("span.term",text));
      else fdjtDOM.append(span,text);
      fdjtDOM.append(tagselt,span," ");
      return span;}
    
    var gloss_cloud=false;
    
    /* The completions element */
    function glossCloud(){
	if (gloss_cloud) return gloss_cloud;
	var seen={};
	var sbook_index=sbook.index;
	var label=fdjtDOM.Image(sbicon("TagIcon32x32.png"),"img.label","tags");
	var outlets_span=fdjtDOM("span.outlets");
	var sources_span=fdjtDOM("span.sources");
	var completions=fdjtDOM("div.completions","\n",label,outlets_span);
	if (sbook.outlets) {
	    var outlets=sbook.outlets;
	    var i=0; var lim=outlets.length;
	    while (i<lim) {
		var outlet=outlets[i++];
		var info=sbook.sourcekb.ref(outlet);
		var completion=fdjtDOM("span.completion.cue.outlet",info.name);
		completion.setAttribute("value",outlet);
		completion.setAttribute("key",info.name);
		if (info.about) completion.title=
		    "share with '"+info.about+"'";
		fdjtDOM(outlets_span,completion," ");}}
	if (sbook.sources) {
	    var outlets=sbook.outlets||[];
	    var sources=sbook.sources;
	    var i=0; var lim=sources.length;
	    while (i<lim) {
		var source=sources[i++];
		if (fdjtKB.contains(outlets,source)) continue;
		var info=sbook.sourcekb.ref(source);
		var completion=fdjtDOM
		("span.completion.source",info.name);
		completion.setAttribute("value",source);
		completion.setAttribute("key",info.name);
		if (info.about) completion.title=
		    "highlight for '"+info.about+"'";
		fdjtDOM(sources_span,completion," ");}}
	completions._seen=seen;
	var tagscores=sbook_index.tagScores();
	var alltags=tagscores._all;
	var i=0; while (i<alltags.length) {
	    var tag=alltags[i++];
	    // We elide sectional tags
	    if ((typeof tag === "string") && (tag[0]==="\u00A7")) continue;
	    var tagnode=Knodule.HTML(tag,sbook.knodule,false,true);
	    fdjtDOM(completions,tagnode," ");}
	var i=0; while (i<alltags.length) {
	    var tag=alltags[i++];
	    // We elide sectional tags
	    if ((typeof tag === "string") && (tag[0]==="\u00A7")) {
		var showname=tag; var title;
		if (showname.length>17) {
		    showname=showname.slice(0,17)+"...";
		    title=tag;}
		var sectnode=
		    fdjtDOM("span.completion",fdjtDOM("span.sectname",showname));
		if (title) sectnode.title=title;
		sectnode.key=tag; sectnode.value=tag;
		fdjtDOM(completions,sectnode," ");
		continue;}}
	// Generic sources go at the end
	fdjtDOM(completions,sources_span);
	//fdjtDOM.addListener(completions,"click",markcloud_onclick);
	completions.onmouseup=glosscloud_onclick;
	gloss_cloud=
	    new fdjtUI.Completions(
		completions,false,
		fdjtUI.FDJT_COMPLETE_OPTIONS|
		    fdjtUI.FDJT_COMPLETE_CLOUD|
		    fdjtUI.FDJT_COMPLETE_ANYWORD);
	return gloss_cloud;}
    sbook.glossCloud=glossCloud;

    function glosscloud_onclick(evt){
	var target=fdjtUI.T(evt);
	var completion=fdjtDOM.getParent(target,'.completion');
	if (completion) addTag(fdjtID("SBOOKGLOSSFORM"),completion);
	fdjtUI.cancel(evt);}

    /* Handling the note field */

    var taginput_timer=false; var complete_delay=250;
    function taginput_keypress(evt){
	if (taginput_timer) {
	    clearTimeout(taginput_timer);
	    taginput_timer=false;}
	var target=fdjtUI.T(evt);
	var ch=evt.charCode;
	if ((ch===13)) {
	  fdjtUI.cancel(evt);
	  var completions=gloss_cloud.complete(target.value);
	  if (completions.length) addTag(target.form,completions[0]);
	  else addTag(target.form,target.value);
	  target.value=""; fdjtDOM.addClass(target,"isempty");
	  return;}
	taginput_timer=setTimeout(function(){
	    fdjtLog("Completing on %o from %o",target.value,target);
	    gloss_cloud.complete(target.value);},
	  complete_delay);}
    sbook.UI.handlers.taginput_keypress=taginput_keypress;
    function taginput_keyup(evt){
      var kc=evt.keyCode;
      if ((kc===8)||(kc===46)) {
	if (taginput_timer) {
	  clearTimeout(taginput_timer);
	  taginput_timer=false;}
	var target=fdjtUI.T(evt);
	taginput_timer=setTimeout(function(){
	    fdjtLog("Completing on %o from %o",target.value,target);
	    gloss_cloud.complete(target.value);},
	  complete_delay);}}
    sbook.UI.handlers.taginput_keypress=taginput_keyup;

    function taginput_focus(evt){
	fdjtUI.AutoPrompt.onfocus(evt);
	fdjtDOM.addClass(sbookHUD,"tagging");}
    function taginput_blur(evt){
	fdjtUI.AutoPrompt.onfocus(evt);
	fdjtDOM.dropClass(sbookHUD,"tagging");}

    /* Handling embedded tags in the NOTE field */

    function gettagspan(input,pt){
	if (fdjtDOM.hasClass(input,"isempty")) return false;
	if ((typeof pt === 'undefined')&&
	    (typeof input.selectionStart === 'number')&&
	    (typeof input.selectionEnd === 'number')&&
	    (input.selectionEnd>input.selectionStart)) {
	    var val=input.value;
	    var start=input.selectionStart;
	    var end=input.selectionEnd;
	    if ((start>=0)&&(val[start]==='[')) start++;
	    if (val[end]===']') end--;
	    return [start,end];}
	if (!(pt)) pt=input.selectionStart;
	var val=input.value;
	var start=val.indexOf('[');
	if ((start<0)||(start>pt)) return false;
	var scan=val.indexOf('[',start+1);
	while ((scan>=0)&&(scan<pt)) {
	    start=scan; scan=val.indexOf('[',start+1);}
	if (start<0) return false;
	var end=val.indexOf(']',start);
	if (end<0) return [start+1,pt];
	else if (end<pt) return false;
	else return [start,end];}

    function gettagstring(input,pt){
	var span=gettagspan(input,pt);
	if (span)
	    return input.value.slice(span[0],span[1]);
	else return false;}

    function tagspan(input){
	var value=input.value;
	var start=value.indexOf('[');
	if (start<0) return false;
	var selstart=input.selectionStart;
	if (start>selstart) return false;
	var scan=value.indexOf('[',start+1);
	while ((scan>0)&&(scan<selstart)) {
	    start=scan; scan=value.indexOf('[',start+1);}
	var end=value.indexOf(']',start);
	if (end<0) return [start+1,selstart];
	else if (end<selstart) return false;
	// else if (start+1===end) return false;
	else return [start+1,end];}
    function istagging(input){
	var form=fdjtDOM.getParent(input,"form");
	var span=tagspan(input);
	if (span) {
	    fdjtDOM.addClass(sbookHUD,"tagging");
	    return span;}
	else {
	    fdjtDOM.dropClass(sbookHUD,"tagging");
	    return false;}}
    function tagcomplete(input){
	var span=istagging(input);
	if (span) gloss_cloud.complete(input.value.slice(span[0],span[1]));}

    sbook.startTagging=function(input,embedded){
	var string=false;
	if (embedded) {
	    var span=istagging(input);
	    if (span) string=input.value.slice(span[0],span[1]);}
	else embedded=input.value;
	if (!((embedded)&&(!(string)))) {
	    fdjtDOM.addClass(sbookHUD,"tagging");
	    gloss_cloud.complete(string);}};
    sbook.stopTagging=function(){
	fdjtDOM.dropClass(sbookHUD,"tagging");};
    
    // This captures either text selection or mouse motion
    function note_mouseup(evt){
	var target=fdjtUI.T(evt);
	if ((typeof target.selectionStart === 'number')&&
	    (typeof target.selectionEnd === 'number')&&
	    (target.selectionEnd>target.selectionStart)) {
	    var value=target.value;
	    var start=target.selectionStart;
	    var end=target.selectionEnd;
	    if (value[start]==='[') start++;
	    if ((end>0)&&(value[end-1]===']')) end--;
	    if (end>start)
		gloss_cloud.complete(value.slice(start,end));}
	else tagcomplete(target);}
    sbook.UI.handlers.note_mouseup=note_mouseup;
    
    function note_focus(evt){
	sbook.startTagging(fdjtUI.T(evt),true);}
    sbook.UI.handlers.note_focus=note_focus;
    function note_blur(evt){
	fdjtDOM.dropClass(sbookHUD,"tagging");}
    sbook.UI.handlers.note_blur=note_blur;
    
    var tagupdate=false;

    function note_keyup(evt){
	var target=fdjtUI.T(evt);
	var form=fdjtDOM.getParent(target,"FORM");
	var tagspan=istagging(target);
	var kc=evt.keyCode;
	if ((tagspan)&&((kc===8)||(kc===46)||(kc===236))) {
	    if (tagupdate) {
		clearTimeout(tagupdate);
		tagupdate=false;}
	    tagupdate=
		setTimeout(function(){tagcomplete(target);},100);}
	else if ((kc===13)&&(evt.ctrlKey)) {
	    var form=fdjtDOM.getParent(fdjtUI.T(evt),"form");
	    fdjtUI.cancel(evt);
	    // Should go through AJAX
	    form.submit();}}
    sbook.UI.handlers.note_keyup=note_keyup;
    function note_keypress(evt){
      var target=fdjtUI.T(evt);
      var form=fdjtDOM.getParent(target,"FORM");
      if (tagupdate) {
	clearTimeout(tagupdate);
	tagupdate=false;}
      var ch=evt.charCode;
      if (ch===91) {
	fdjtDOM.addClass(sbookHUD,"tagging");
	gloss_cloud.complete("");
	return;}
      var tagspan=istagging(target);
      if (!(tagspan)) return;
      var value=target.value;
      var tagstring=value.slice(tagspan[0],tagspan[1]);
      if (ch===93) {
	var completions=gloss_cloud.complete(tagstring);
	if (completions.length) {
	  target.value=
	    value.slice(0,tagspan[0])+
	    gloss_cloud.getKey(completions[0])+
	    ((value[tagspan[1]]===']')?
	     (value.slice(tagspan[1]+1)):((value.slice(tagspan[1]))));
	  addTag(form,completions[0]);}
	else addTag(form,tagstring);
	gloss_cloud.complete("");}
      else if ((ch===34)||(ch===13)) {
	addTag(form,tagstring);
	target.value=
	  value.slice(0,tagspan[1])+
	  ((value[tagspan[1]+1]===']')?'':']')+
	  value.slice(tagspan[1]);
	fdjtUI.cancel(evt);
	target.selectionStart=target.selectionEnd=tagspan[1]+1;
	gloss_cloud.complete("");}
      else tagupdate=
	     setTimeout(function(){tagcomplete(target);},100);}
    sbook.UI.handlers.note_keypress=note_keypress;
    
    function setupGlossForm(form){
	if (form.getAttribute("sbooksetup")) return;
	fdjtDOM.getInput(form,"REFURI").value=sbook.refuri;
	fdjtDOM.getInput(form,"USER").value=sbook.user.qid;
	fdjtDOM.getInput(form,"DOCTITLE").value=document.title;
	fdjtDOM.getInput(form,"SOURCE").value=document.location.href;
	var noteinput=fdjtDOM.getInput(form,"NOTE");
	noteinput.onfocus=note_focus;
	noteinput.onblur=note_blur;
	noteinput.onkeypress=note_keypress;
	noteinput.onkeyup=note_keyup;
	noteinput.onmouseup=note_mouseup;
	var taginput=fdjtDOM.getInput(form,"TAG");
	taginput.onkeypress=taginput_keypress;
	taginput.onkeyup=taginput_keyup;
	taginput.onfocus=taginput_focus;
	taginput.onblur=taginput_blur;
	if (sbook.syncstamp)
	    fdjtDOM.getInput(form,"SYNC").value=(sbook.syncstamp+1);
	fdjtUI.AutoPrompt.setup(form);
	form.onsubmit=submitGloss;
	form.oncallback=addgloss_callback;
	form.setAttribute("sbooksetup","yes");}
    sbook.setupGlossForm=setupGlossForm;

    function setGlossTarget(target,form){
	if (!(form)) form=fdjtID("SBOOKGLOSSFORM");
	if (!gloss_cloud) sbook.glossCloud();
	if (typeof target === 'string') target=fdjtID(id);
	var idelt=fdjtDOM.getInput(form,"FRAG");
	if (idelt.value===target.id) {return;}
	idelt.value=target.id;
	var uuidelt=fdjtDOM.getInput(form,"UUID");
	uuidelt.value=fdjtState.getUUID(sbook.nodeid);
	var syncelt=fdjtDOM.getInput(form,"SYNC");
	syncelt.value=(sbook.syncstamp+1);
	var note=fdjtDOM.getInput(form,"NOTE");
	var tag=fdjtDOM.getInput(form,"TAG");
	var href=fdjtDOM.getInput(form,"HREF");
	note.value=""; fdjtDOM.addClass(note,"isempty");
	tag.value=""; fdjtDOM.addClass(tag,"isempty");
	href.value=""; fdjtDOM.addClass(href,"isempty");
	// This puts the prompts back into the fields
	fdjtUI.AutoPrompt.setup(form,true);
	var tagselt=fdjtDOM.getChild(form,".tags");
	var tagspans=fdjtDOM.$(".checkspan",tagselt);
	if (tagspans) {
	    var i=0; var lim=tagspans.length;
	    while (i<lim) {
		fdjtDOM.remove(tagspans[i++]);}}
	var info=sbook.docinfo[target.id];
	var tags=[].concat(info.tags);
	var glosses=sbook.glosses.find('frag',target.id);
	var i=0; var lim=glosses.length;
	while (i<lim) {
	    var g=glosses[i++]; var gtags=g.tags;
	    if (gtags) tags=tags.concat(gtags);}
	var cursoft=fdjtDOM.getChildren(gloss_cloud.dom,".cue.softcue");
	var i=0; var lim=cursoft.length;
	while (i<lim) {
	    var cur=cursoft[i++];
	    fdjtDOM.dropClass(cur,"cue");
	    fdjtDOM.dropClass(cur,"softcue");}
	var newcues=gloss_cloud.getByValue(tags);
	var i=0; var lim=newcues.length;
	while (i<lim) {
	    var completion=newcues[i++];
	    if (!(fdjtDOM.hasClass(completion,"cue"))) {
		fdjtDOM.addClass(completion,"cue");
		fdjtDOM.addClass(completion,"softcue");}}}
    sbook.setGlossTarget=setGlossTarget;

    function addgloss_callback(req){
	if (sbook.Trace.network)
	    fdjtLog("Got AJAX gloss response %o from %o",req,sbook_mark_uri);
	fdjtKB.Import(JSON.parse(req.responseText));
	// Clear the UUID, and other fields
	var uuid=fdjtDOM.getInput(fdjtID("SBOOKGLOSSFORM"),"UUID");
	if (uuid) uuid.value="";
	var note=fdjtDOM.getInput(fdjtID("SBOOKGLOSSFORM"),"NOTE");
	if (note) note.value="";
	var taginput=fdjtDOM.getInput(fdjtID("SBOOKGLOSSFORM"),"TAG");
	if (taginput) taginput.value="";
	var href=fdjtDOM.getInput(fdjtID("SBOOKGLOSSFORM"),"HREF");
	if (href) href.value="";
	sbook.preview_target=false;
	/* Turn off the target lock */
	sbook.setTarget(false);
	sbookMode(false);}

    // Here's how it works:
    //  When typing, go back to the open bracket and try to complete
    //  When you type a ], force a completion
    //  When you click the tag icon, 
    //    Get the tagtext, which is either
    //    if text is selected and it's bracketed, force a completion
    //    otherwise, bracket it and probe a completion
    //    if no text is selected but you're in a tag

    function submitGloss(evt){
	evt=evt||event||null;
	var form=fdjtUI.T(evt);
	var uuidelt=fdjtDOM.getInput(form,"UUID");
	if (!((uuidelt)&&(uuidelt.value)&&(uuidelt.value.length>5)))
	    alert('missing UUID');
	fdjtUI.AutoPrompt.cleanup(form);
	if (!(sbook.offline)) return fdjtAjax.onsubmit(evt);
	if (!(navigator.onLine)) return saveGloss(form,evt);
	// Eventually, we'll unpack the AJAX handler to let it handle
	//  connection failures by calling saveGloss.
	else return fdjtAjax.onsubmit(evt);}
    sbook.submitGloss=submitGloss;

    function saveGloss(form,evt){
	var json=fdjtAjax.formJSON(form,["tags","xrefs"],true);
	var params=fdjtAjax.formParams(form);
	var queued=fdjtState.getLocal("queued("+sbook.refuri+")",true);
	if (!(queued)) queued=[];
	queued.push(json.uuid);
	var glossdata=
	    {refuri: json.refuri,frag: json.frag,user: json.user,uuid: json.uuid,
	     qid: json.uuid,gloss: json.uuid};
	glossdata.tstamp=fdjtTime.tick();
	if ((json.note)&&(!(fdjtString.isEmpty(json.note)))) glossdata.note=json.note;
	if ((json.excerpt)&&(!(fdjtString.isEmpty(json.excerpt)))) glossdata.excerpt=json.excerpt;
	if ((json.details)&&(!(fdjtString.isEmpty(json.details)))) glossdata.details=json.details;
	if ((json.tags)&&(json.tags.length>0)) glossdata.tags=json.tags;
	if ((json.xrefs)&&(json.xrefs.length>0)) glossdata.xrefs=json.xrefs;
	sbook.glosses.Import(glossdata);
	fdjtState.setLocal("params("+json.uuid+")",params);
	fdjtState.setLocal("queued("+sbook.refuri+")",queued,true);
	// Clear the UUID
	fdjtID("SBOOKMARKUUID").value="";
	sbook.preview_target=false;
	if (evt) fdjtUI.cancel(evt);
	/* Turn off the target lock */
	sbook.setTarget(false);
	sbookMode(false);}
    function writeGlosses(){
	if (!(sbook.offline)) return;
	var queued=fdjtState.getLocal("queued("+sbook.refuri+")",true);
	if ((!(queued))||(queued.length===0)) {
	    fdjtState.dropLocal("queued("+sbook.refuri+")");
	    return;}
	var ajax_uri=fdjtID("SBOOKMARKFORM").getAttribute("ajaxaction");
	var i=0; var lim=queued.length; var pending=[];
	while (i<lim) {
	    var uuid=queued[i++];
	    var params=fdjtState.getLocal("params("+uuid+")");
	    if (params) pending.push(uuid);
	    var req=new XMLHttpRequest();
	    req.open('POST',ajax_uri);
	    req.withCredentials='yes';
	    req.onreadystatechange=function () {
		if ((req.readyState === 4) && (req.status>=200) && (req.status<300)) {
		    fdjtState.dropLocal("params("+uuid+")");
		    oncallback(req);}};
	    try {
		req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		req.send(params);}
	    catch (ex) {failed.push(uuid);}}
	if ((pending)&&(pending.length))
	    fdjtState.setLocal("queued("+sbook.refuri+")",pending,true);
	else fdjtState.dropLocal("queued("+sbook.refuri+")");
	if ((pending)&&(pending.length>0)) return pending;
	else return false;}
    sbook.writeGlosses=writeGlosses;
    
})();
/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/