/* -*- Mode: Javascript; -*- */

var codex_toc_id="$Id$";
var codex_toc_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009-2011 beingmeta, inc.
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

/* New NAV hud design
   One big DIV for the whole TOC, use CSS to change what's visible
   General structure:
   div.codextoc.toc0
   div.head (contains section name)
   div.spanbar (contains spanbar)
   div.sub (contains all the subsections names)
   div.codextoc.toc1 (tree for first section)
   div.codextoc.toc1 (tree for second section)
   Controlling display:
   .cur class on current head
   .live class on div.codextoc and parents
*/

/* Building the DIV */

var CodexTOC=
    (function(){
	function sbicon(base){return sbook.graphics+base;}
	function navicon(kind){
	    if (sbook.touch) {
		switch (kind) {
		case 'right': return sbicon("GoldRightTriangle32.png");
		case 'left': return sbicon("GoldLeftTriangle32.png");
		case 'start': return sbicon("GoldLeftStop32.png");
		case 'end': return sbicon("GoldRightStop32.png");}}
	    else {
		switch (kind) {
		case 'right': return sbicon("GoldRightTriangle24.png");
		case 'left': return sbicon("GoldLeftTriangle24.png");
		case 'start': return sbicon("GoldLeftStop24.png");
		case 'end': return sbicon("GoldRightStop24.png");}}}
	sbook.navicon=navicon;

	function CodexTOC(headinfo,depth,tocspec,prefix,headless){
	    var progressbar=fdjtDOM("HR.progressbar");
	    var head=((headless)?(false):
		      (fdjtDOM("A.sectname",headinfo.title)));
	    var spec=tocspec||"DIV.codextoc";
	    var next_button=
		((head)&&
		 ((headinfo.next)?
		  (fdjtDOM.Image(navicon("right"),false,"next")):
		  (fdjtDOM.Image(navicon("end"),false,"nextstop"))));
	    if ((next_button)&&(headinfo.next))
		next_button.frag=headinfo.next.frag;
	    var back_button=
		((head)&&
		 ((headinfo.prev)?
		  (fdjtDOM.Image(navicon("left"),false,"back")):
		  (fdjtDOM.Image(navicon("start"),false,"backstop"))));
	    if ((back_button)&&(headinfo.prev))
		back_button.frag=headinfo.prev.frag;
	    var toc=fdjtDOM(spec,
			    next_button,back_button,
			    ((head)&&(fdjtDOM("DIV.head",progressbar,head))),
			    generate_spanbar(headinfo),
			    generate_subsections(headinfo));
	    var sub=headinfo.sub;
	    if (!(depth)) depth=0;
	    head.name="SBR"+headinfo.frag;
	    head.frag=headinfo.frag;
	    toc.sbook_start=headinfo.starts_at;
	    toc.sbook_end=headinfo.ends_at;
	    fdjtDOM.addClass(toc,"toc"+depth);
	    toc.id=(prefix||"CODEXTOC4")+headinfo.frag;
	    head.name="SBR"+headinfo.frag;
	    if ((!(sub)) || (!(sub.length))) {
		fdjtDOM.addClass(toc,"codextocleaf");
		return toc;}
	    var i=0; var n=sub.length;
	    while (i<n) {
		toc.appendChild(CodexTOC(sub[i++],depth+1,spec,prefix));}
	    return toc;}
	
	function tocJump(evt,target){
	    if (!(target)) target=fdjtUI.T(evt);
	    while (target) {
		if (target.frag) break;
		else target=target.parentNode;}
	    if (target) {
		var info=sbook.docinfo[target.frag];
		sbook.GoTo(target.frag);
		if ((info.sub)&&(info.sub.length>2))
		    CodexMode("toc");
		else CodexMode("tocscan");
		fdjtUI.cancel(evt);}}
	sbook.tocJump=tocJump;

	function generate_subsections(headinfo) {
	    var sub=headinfo.sub;
	    if ((!(sub)) || (!(sub.length))) return false;
	    var div=fdjtDOM("div.sub");
	    var i=0; var n=sub.length;
	    while (i<n) {
		var subinfo=sub[i];
		var subspan=fdjtDOM("A.sectname",subinfo.title);
		subspan.frag=subinfo.frag;
		subspan.name="SBR"+subinfo.frag;
		fdjtDOM(div,((i>0)&&" \u00b7 "),subspan);
		i++;}
	    return div;}
	
	function generate_spanbar(headinfo){
	    var spanbar=fdjtDOM("div.spanbar.codexslice");
	    var spans=fdjtDOM("div.spans");
	    var start=headinfo.starts_at;
	    var end=headinfo.ends_at;
	    var len=end-start;
	    var subsections=headinfo.sub; var last_info;
	    var sectnum=0; var percent=0;
	    spanbar.starts=start; spanbar.ends=end;
	    if ((!(subsections)) || (subsections.length===0))
		return false;
	    var progress=fdjtDOM("div.progressbox","\u00A0");
	    var range=false; var lastspan=false;
	    fdjtDOM(spanbar,spans);
	    fdjtDOM(spans,range,progress);
	    progress.style.left="0%";
	    if (range) range.style.left="0%";
	    var i=0; while (i<subsections.length) {
		var spaninfo=subsections[i++];
		var subsection=document.getElementById(spaninfo.frag);
		var spanstart; var spanend; var addname=true;
		if ((sectnum===0) && ((spaninfo.starts_at-start)>0)) {
		    /* Add 'fake section' for the precursor of the first actual section */
		    spanstart=start;  spanend=spaninfo.starts_at;
		    spaninfo=headinfo;
		    subsection=document.getElementById(headinfo.frag);
		    i--; sectnum++; addname=false;}
		else {
		    spanstart=spaninfo.starts_at; spanend=spaninfo.ends_at;
		    sectnum++;}
		var span=generate_span
		(sectnum,subsection,spaninfo.title,spanstart,spanend,len,
		 ((addname)&&("SBR"+spaninfo.frag)),start);
		lastspan=span;
		spans.appendChild(span);
		last_info=spaninfo;}
	    if ((end-last_info.ends_at)>0) {
		/* Add 'fake section' for the content after the last
		 * actual section */
		var span=generate_span
		(sectnum,head,headinfo.title,last_info.ends_at,end,len,start);
		spanbar.appendChild(span);}    
	    return spanbar;}
	
	function generate_span(sectnum,subsection,title,spanstart,spanend,len,name,pstart){
	    var spanlen=spanend-spanstart;
	    var anchor=fdjtDOM("A.brick","\u00A0");
	    var span=fdjtDOM("DIV.codexhudspan",anchor);
	    var width=(Math.round(100000000*(spanlen/len))/1000000);
	    var left=(Math.round(100000000*((spanstart-pstart)/len))/1000000);
	    span.style.left=left+"%";
	    span.style.width=width+"%";
	    span.title=(title||"section")+
		" ("+Math.round(left)+"%-"+(Math.round(left+width))+"%)";
	    span.frag=subsection.id;
	    if (name) anchor.name=name;
	    return span;}
	CodexTOC.id="$Id$";
	CodexTOC.version=parseInt("$Revision$".slice(10,-1));

	function updateTOC(prefix,head,cur){
	    if (!(prefix)) prefix="CODEXTOC4";
	    if (cur) {
		// Hide the current head and its (TOC) parents
		var tohide=[];
		var spans=document.getElementsByName("SBR"+cur.frag);
		var base_elt=document.getElementById(prefix+cur.frag);
		fdjtDOM.dropClass(spans,"live");
		while (cur) {
		    var tocelt=document.getElementById(prefix+cur.frag);
		    tohide.push(tocelt);
		    // Get TOC parent
		    cur=cur.head;}
		var n=tohide.length-1;
		// Go backwards (up) to potentially accomodate some redisplayers
		while (n>=0) {fdjtDOM.dropClass(tohide[n--],"live");}
		fdjtDOM.dropClass(base_elt,"cur");}
	    if (!(head)) return;
	    var base_elt=document.getElementById(prefix+head.frag);
	    var toshow=[];
	    while (head) {
		var tocelt=document.getElementById(prefix+head.frag);
		var spans=document.getElementsByName("SBR"+head.frag);
		fdjtDOM.addClass(spans,"live");
		toshow.push(tocelt);
		head=head.head;}
	    var n=toshow.length-1;
	    // Go backwards to accomodate some redisplayers
	    while (n>=0) {fdjtDOM.addClass(toshow[n--],"live");}
	    fdjtDOM.addClass(base_elt,"cur");};
	CodexTOC.update=updateTOC;

	return CodexTOC;})();


fdjt_versions.decl("codex",codex_toc_version);
fdjt_versions.decl("codex/toc",codex_toc_version);

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
