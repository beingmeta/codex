/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/layout.js ###################### */

/* Copyright (C) 2009-2012 beingmeta, inc.
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

/* Reporting progress, debugging */
	
var CodexSections=
    (function(){
	var TOA=fdjtDOM.toArray;
	var getChildren=fdjtDOM.getChildren;
	var getParent=fdjtDOM.getParent;
	var addClass=fdjtDOM.addClass;
	var dropClass=fdjtDOM.dropClass;
	var swapClass=fdjtDOM.swapClass;
	var hasClass=fdjtDOM.hasClass;
	var hasContent=fdjtDOM.hasContent;
	var hasText=fdjtDOM.hasText;
	var getStyle=fdjtDOM.getStyle;
	var emptyString=fdjtString.isEmpty;
	var atoi=parseInt;
	var floor=Math.floor;
	var secs2short=fdjtTime.secs2short;

	function layoutMessage(msg){
	    fdjtUI.ProgressBar.setMessage("CODEXLAYOUTMESSAGE",msg);}
	
	function is_section(node){
	    return (node.nodeType===1) &&
		((node.tagName==='SECTION')||
		 ((node.tagName==='DIV')&&
		  (hasClass(node,'sbooksection'))));}
	
	function getGeom(elt,root){
	    var top = elt.offsetTop;
	    var left = elt.offsetLeft;
	    var width=elt.offsetWidth;
	    var height=elt.offsetHeight;
	    var rootp=((root)&&(root.offsetParent));
	    
	    if (elt===root) 
		return {left: 0,top: 0,width:width,height: height,
			right: width,bottom: height};
	    elt=elt.offsetParent;
	    while (elt) {
		if ((root)&&((elt===root)||(elt===rootp))) break;
		top += elt.offsetTop;
		left += elt.offsetLeft;
		elt=elt.offsetParent;}
	    
	    return {left: left, top: top, width: width,height: height,
		    right:left+width,bottom:top+height};}

	var forcebreakbefore=
	    fdjtDOM.sel(fdjtDOM.getMeta("forcebreakbefore",true));
	var forcebreakafter=
	    fdjtDOM.sel(fdjtDOM.getMeta("forcebreakafter",true));
	var avoidbreakbefore=
	    fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakbefore",true));
	var avoidbreakafter=
	    fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakafter",true));
	var avoidbreakinside=
	    fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakinside",true));
	var fullpages=fdjtDOM.sel(fdjtDOM.getMeta("sbookfullpage",true));
	
	function avoidBreakBefore(elt,style){
	    if (hasClass(elt,"avoidbreakbefore")) return true;
	    if (!(style)) style=getStyle(elt);
	    if (style.pageBreakBefore==='avoid') return true;
	    if (avoidbreakbefore) return avoidbreakbefore.match(elt);
	    else return false;}
	function avoidBreakInside(elt,style){
	    if (hasClass(elt,"avoidbreakinside")) return true;
	    if (!(style)) style=getStyle(elt);
	    if (style.pageBreakInside==='avoid') return true;
	    if (avoidbreakinside) return avoidbreakinside.match(elt);
	    else return false;}
	function avoidBreakAfter(elt,docinfo,style){
	    if ((docinfo)&&(elt.id)&&(docinfo[elt.id])&&
		(docinfo[elt.id].toclevel))
		return true;
	    if (hasClass(elt,"avoidbreakafter")) return true;
	    if (!(style)) style=getStyle(elt);
	    if (style.pageBreakAfter==='avoid') return true;
	    if (avoidbreakafter) return avoidbreakafter.match(elt);
	    else return false;}
	function forceBreakBefore(elt,style){
	    if (hasClass(elt,"forcebreakbefore")) return true;
	    if (!(style)) style=getStyle(elt);
	    if (style.pageBreakBefore==='force') return true;
	    if (forcebreakbefore) return forcebreakbefore.match(elt);
	    else return false;}
	function forceBreakAfter(elt,style){
	    if (hasClass(elt,"forcebreakafter")) return true;
	    if (!(style)) style=getStyle(elt);
	    if (style.pageBreakAfter==='force') return true;
	    if (forcebreakafter) return forcebreakafter.match(elt);
	    else return false;}
	function isTransformed(elt){
	    var tv=elt.style[fdjtDOM.transform];
	    if ((tv)&&(tv!=='none')) return true;
	    else return false;}
	
	function CodexSections(content,docinfo,opts){
	    if (!(opts)) opts={};
	    if (Codex.layout) {
		if (CodexLayout instanceof CodexSections) {
		    return Codex.layout;}
		else if (!(Codex.layout.done)) {
		    if (Codex.layout.timer) {
			clearTimeout(Codex.layout.timer);
			Codex.layout.timer=false;}
		    Codex.layout.Revert();
		    Codex.layout=false;}
		else {
		    Codex.layout.Revert();
		    Codex.layout=false;}}

	    var tracelevel=this.tracelevel=opts.tracelevel||Codex.Trace.layout;

	    this.root=content;
	    this.lastid=false;

	    Codex.layout=this;

	    var coverpage=Codex.getCover();
	    if (coverpage) {
		var coversect=
		    fdjtDOM("section.fullpage#COVERSECTION",coverpage);
		fdjtDOM.prepend(content,coversect);}

	    var height=this.height=
		fdjtDOM.getGeometry("CODEXWINDOW",false,true).inner_height;
	    var width=this.width=
		fdjtDOM.getGeometry("CODEXWINDOW",false,true).inner_width;
	    var splits=this.splits={};

	    var started=this.started=fdjtTime();

	    var scaled=this.scaled=[];

	    CodexLayout.applyPageScaling(
		fdjtDOM.$(".sbookpagescaled,.pagescaled"),scaled,width,height);
	    
	    addClass(document.body,"cxLAYOUT");

	    var dups=this.dups={};
	    this.pagebreaks=[];
	    this.pagetops=[];
	    this.scaled=[];

	    if (opts.tocdepth) this.tocdepth=opts.tocdepth;

	    if (Codex.Trace.layout)
		fdjtLog("Adding layout sections to %o",content);
	    
	    layoutMessage("Laying out initial sections");

	    if (Codex.page_style==='fastpage')
		// This also splits based on height
		this.roots=this.addSections(content,docinfo,height);
	    else this.roots=this.addSections(content,docinfo,false);
	    if (Codex.Trace.layout)
		fdjtLog("Added %d layout sections to %o",
			fdjtDOM.$("section.codexwrapper").length,content);
	    
	    if (Codex.Trace.layout)
		fdjtLog("Gathering sections from %o",content);
	    this.sections=gatherSections(content,[],docinfo);
	    if (Codex.Trace.layout)
		fdjtLog("Gathered %d sections from %o",
			this.sections.length,content);
	    return this;}
	    
	function addSections(node,docinfo,page_height,toplevel){
	    var open=false; var inserted=false;
	    var splits=this.splits; var dups=this.dups;
	    if (typeof page_height === 'undefined') page_height=this.height; 
	    var children=fdjtDOM.toArray(node.childNodes);
	    var last_child=false; var tail=[];
	    var tracelevel=Codex.Trace.layout;
	    var content=Codex.content;
	    var sections=[];
	    var i=0; var lim=children.length;
	    if (tracelevel>1)
		fdjtLog("addSections %o ph=%o",node,page_height);
	    while (i<lim) {
		var child=inserted||children[i++]; inserted=false;
		if ((open)&&(tracelevel>2)) {
		    fdjtLog("expandSections o=%o ch=%o ph=%o",
			    open,content.offsetHeight,page_height);}
		if ((open)&&(page_height)&&
		    (content.offsetHeight>page_height)) {
		    addClass(open,"codexoverflow");
		    dropClass(open,"codexvisible");
		    open=false;}
		else if ((last_child)&&(forceBreakAfter(last_child))) {
		    if (open) dropClass(open,"codexvisible");
		    open=false;}
		if (child.nodeType!==1) {
		    // Basically replace it with a section wrapping
		    //  the non-element node
		    if (!(open)) {
			open=fdjtDOM("section.codexwrapper.codexvisible");
			sections.push(open);
			node.insertBefore(open,child);}
		    open.appendChild(child);
		    if (last_child) tail.push(child);}
		else if ((hasClass(child,"sbookpage"))||
			 (hasClass(child,"fullpage"))||
			 ((fullpages)&&(fullpages.test(child)))) {
		    if (open) {
			dropClass(open,"codexvisible");
			open=false;}
		    var sect;
		    if (!(is_section(child))) {
			sect=fdjtDOM("section.codexwrapper.codexvisible");
			node.insertBefore(sect,child);
			sect.appendChild(child);}
		    else {
			sect=child; addClass(sect,"codexvisible");}
		    if ((page_height)&&(sect.offsetHeight>page_height)) {
			var scale=(page_height*0.9)/sect.offsetHeight;
			if (tracelevel>1) fdjtLog("Scaling node %o by %o",sect,scale);
			addClass(sect,"codexscaled");
			sect.style[fdjtDOM.transform]='scale('+scale+')';
			sect.style[fdjtDOM.transformOrigin]='top center';}
		    sections.push(sect);
		    dropClass(sect,"codexvisible");
		    open=false;}
		else if (is_section(child)) {
		    // Display of sections is disjoint, so we're done with the
		    //  open section
		    if (open) {dropClass(open,"codexvisible"); open=false;}
		    sections.push(child);
		    addClass(child,"codexlive");
		    if (!(avoidBreakInside(child))) {
			// Recur into this section
			this.addSections(child,docinfo,page_height,splits);}
		    // And then we're done!
		    dropClass(child,"codexlive");
		    last_child=child; tail=[child];}
		else if (((child.id)&&(docinfo[child.id])&&
			  (docinfo[child.id].toclevel)&&
			  ((!(this.tocdepth))||
			   (docinfo[child.id].toclevel<this.tocdepth)))||
			 (forceBreakBefore(child))) {
		    var info=((child.id)&&(docinfo[child.id]));
		    if (open) dropClass(open,"codexvisible");
		    // Starting a new section
		    if (tracelevel>2)
			fdjtLog("Starting new section starting with %o",child);
		    open=fdjtDOM("section.codexwrapper.codexvisible");
		    sections.push(open);
		    if (info) open.setAttribute(
			"data-sbookloc",info.starts_at);
		    node.insertBefore(open,child);
		    open.appendChild(child);
		    if ((page_height)&&(open.offsetHeight>page_height)) {
			var scale=(page_height*0.9)/open.offsetHeight;
			if ((scale>0.8)||
			    (hasClass(child,"sbookpage"))||
			    (hasClass(child,"fullpage"))||
			    ((fullpages)&&(fullpages.test(child)))) {
			    if (tracelevel>1)
				fdjtLog("Scaling node %o by %o",sect,scale);
			    addClass(open,"codexscaled");
			    open.style[fdjtDOM.transform]='scale('+scale+')';
			    open.style[fdjtDOM.transformOrigin]='top center';}
			dropClass(open,"codexvisible");
			open=false;}
		    last_child=false; tail=[];}
		else if (open) {
		    var info=((child.id)&&(docinfo[child.id]));
		    var split=false;
		    // Get this now and use it to determine whether or
		    //  not to try to break the node.
		    var open_height=content.offsetHeight;
		    open.appendChild(child);
		    if ((open)&&(page_height)&&
			((content.offsetHeight)>page_height)) {
			// We have an overflow; this is where we might split
			var newsect=fdjtDOM("section.codexwrapper.codexvisible");
			fdjtDOM.insertAfter(open,newsect);
			sections.push(newsect);
			if ((splits)&&(open_height<(page_height*0.8))&&
			    (!(avoidBreakInside(child)))) {
			    var tmp_height=
				(((content.offsetHeight)<(page_height*1.1))?
				 (page_height*0.9):(page_height));
			    split=splitBlock(child,open,newsect,floor(page_height),splits);
			    if (split) {
				var id=(child.id)||
				    (child.id=fdjtState.getUUID());
				if (this.dupfn) this.dupfn(split,child);
				if (dups[id]) dups[id].push(split);
				else dups[id]=[split];}
			    if (split) {
				fdjtDOM.insertAfter(open,split);
				inserted=split;}}
			else if ((last_child)&&
				 ((avoidBreakBefore(child))||
				  (avoidBreakAfter(last_child)))) {
			    // To keep with layout constraints, we
			    // can't just start the new page with
			    // *child*, but we need to drag along
			    // *last_child* and whatever non-element
			    // nodes followed it (the contains of
			    // *tail*).
			    if (tracelevel>2) {
				fdjtLog("breakSection o=%o ch=%o at %o for %o",
					open,content.offsetHeight,
					last_child,child);}
			    fdjtDOM(newsect,tail,child);}
			else {
			    // Just start a new page/section
			    // containing just *child*
			    if (tracelevel>2) {
				fdjtLog("breakSection o=%o ch=%o at %o",
					open,content.offsetHeight,
					last_child,child);}
			    fdjtDOM(newsect,child);}
			if (open) dropClass(open,"codexvisible");
			open=newsect;}
		    else if (hasClass(child,"codexsplit")) {
			swapClass(child,"codexsplit","codexsplitend");}
		    else {}
		    last_child=child; tail=[child];}
		else {
		    if (open) dropClass(open,"codexvisible");
		    open=fdjtDOM("section.codexwrapper.codexvisible");
		    node.insertBefore(open,child);
		    sections.push(open);
		    if (last_child) {
			fdjtDOM(open,tail,child);
			last_child=false; tail=[];}
		    else open.appendChild(child);}
		if ((child.nodeType===1)&&(child.id)&&(docinfo[child.id])) {
		    var starts=docinfo[child.id].starts_at;
		    if (starts) {
			var pct=(100*starts)/Codex.ends_at;
			fdjtUI.ProgressBar.setProgress("CODEXLAYOUTMESSAGE",pct);
			var msg=fdjtString("Done with %s%% of initial layout in %s",
					   fdjtString.precString(pct,2),
					   secs2short((fdjtTime()-this.started)/1000));
			layoutMessage(msg);}}}
	    if (open) dropClass(open,"codexvisible");
	    return sections;}
	CodexSections.prototype.addSections=addSections;

	/* Splitting blocks */

	function splitBlock(block,page,nextpage,page_height,splits){
	    var id=block.id;
	    if (!(id)) id=block.id=fdjtState.getUUID();
	    var children=splits[id]=fdjtDOM.toArray(block.childNodes);
	    var clone=block.cloneNode(false); var split=false; clone.id=null;
	    var tracelevel=this.tracelevel||Codex.Trace.layout;
	    if (tracelevel>1)
		fdjtLog("Trying to split block %o between %o and %o (ph=%o)",
			block,page,nextpage,page_height);
	    nextpage.appendChild(clone);
	    var i=0; var lim=children.length;
	    while (i<lim) {block.removeChild(children[i++]);}
	    if (page.offsetHeight>page_height) {
		// Even when empty, it's over the edge, so give up
		i=0; while (i<lim) {block.appendChild(children[i++]);}
		nextpage.removeChild(clone);
		nextpage.appendChild(block);
		return false;}
	    i=0; while (i<lim) {
		var child=children[i];
		block.appendChild(child); 
		if (child.nodeType!==3) {
		    if (page.offsetHeight>page_height) break;
		    else i++;}
		else if (page.offsetHeight>page_height) {
		    split=splitTextChild(child,block,page,nextpage,page_height,tracelevel);
		    // If we split, that means that the remainder of
		    // the children go in the clone, so we increment i
		    if (split) {clone.appendChild(split); i++;}
		    break;}
		else i++;}
	    if (tracelevel>1)
		fdjtLog("Split block %o at %o (%d)",block,children[i],i);
	    if (i===0) {
		while (i<lim) {block.appendChild(children[i++]);}
		nextpage.removeChild(clone);
		nextpage.appendChild(block);
		return false;}
	    while (i<lim) clone.appendChild(children[i++]);
	    addClass(block,"codexsplitstart");
	    addClass(clone,"codexsplit");
	    clone.setAttribute("data-originated",id);
	    return clone;}

	function splitTextChild(child,node,page,nextpage,page_height,tracelevel){
	    var text=child.nodeValue;
	    var breaks=text.split(/\b/g), words=[];
	    var word=false; var bi=0, blen=breaks.length;
	    if (tracelevel>1)
		fdjtLog("Trying to split text block %o in %o",child,node);
	    if (blen<2) return false;;
	    while (bi<blen) {
		var s=breaks[bi++];
		if (!(word)) word=s;
		else if (s.search(/\s/)===0) {
		    words.push(word);
		    if (bi<blen) word=s+breaks[bi++];}
		else word=word+s;}
	    if (word) words.push(word);
	    // If there's only one word, no splitting today,
	    if (words.length<2) return false;
	    var w=0; var wlen=words.length;
	    var pagebreak=floor(wlen/2);
	    var top=wlen; var bot=0;
	    var foundbreak=false;
	    var probenode=false;
	    // We do a binary search and test for being at the edge by
	    // adding the next word; if that pushes us *child* over
	    // *page_height*, we know we're at the edge.
	    while ((pagebreak>=bot)&&(pagebreak<top)) {
		var newprobe=document.createTextNode(words.slice(0,pagebreak).join(""));
		if (probenode) node.replaceChild(newprobe,probenode);
		else node.replaceChild(newprobe,child);
		probenode=newprobe;
		if (page.offsetHeight>page_height) {
		    top=pagebreak; pagebreak=bot+floor((pagebreak-bot)/2);}
		else {
		    var nextw=document.createTextNode(words[pagebreak]);
		    node.appendChild(nextw);
		    var atedge=(page.offsetHeight>page_height);
		    node.removeChild(nextw);
		    if (atedge) {foundbreak=true; break;}
		    else {
			bot=pagebreak+1;
			pagebreak=pagebreak+floor((top-pagebreak)/2);}}}
	    if (pagebreak+1===top) foundbreak=true;
	    // We're done searching for the page break
	    if ((pagebreak===0)||(pagebreak===wlen-1)) foundbreak=false;
	    if (foundbreak) { // Do the split
		var splitoff=document.createTextNode(
		    // This is the text pushed onto the new page
		    words.slice(pagebreak).join(""));
		if (tracelevel>1)
		    fdjtLog("Split text block after %s",words.slice(0,pagebreak).join(""));
		return splitoff;}
	    else {
		node.replaceChild(child,probenode);
		return false;}}

	/* Cleanup */

	CodexSections.prototype.Revert=function(){
	    var splits=this.splits;
	    for (key in splits) {
		var root=document.getElementById(key);
		var children=fdjtDOM.toArray(root.childNodes);
		var restore=splits[key];
		var i=0; var lim=children.length;
		while (i<lim) root.removeChild(children[i++]);
		dropClass(root,"codexsplitstart");
		i=0; lim=restore.length;
		while (i<lim) root.appendChild(restore[i++]);}
	    fdjtDOM.remove(fdjtDOM.getChildren(".codexsplit"));
	    fdjtDOM.remove(fdjtDOM.getChildren(".codexsplitend"));
	    CodexLayout.revertPageScaling(this.scaled);
	    removeSections(this.root);};
	
	function removeSection(sect){
	    var parent=sect.parentNode;
	    var children=TOA(sect.childNodes);
	    var i=children.length-1;
	    while (i>=0) {
		parent.insertBefore(children[i--],sect);}
	    parent.removeChild(sect);}

	function removeSections(root){
	    var toremove=TOA(getChildren(root,"section.codexwrapper"));
	    var i=0; var lim=toremove.length;
	    while (i<lim) removeSection(toremove[i++]);}

	/* Gathering sections from a root for use in selective section/page display */

	function just_whitespace(sect){
	    var c=sect.childNodes;
	    var i=0; var lim=c.length;
	    while (i<lim) {
		var child=c[i++];
		if ((child.nodeType!==3)||(!(emptyString(child.nodeValue))))
		    return false;}
	    return true;}

	function gatherSections(root,sections,docinfo){
	    if (typeof sections === 'undefined') sections=[];
	    if ((root.nodeType===1)&&(root.childNodes.length)) {
		var children=root.childNodes;
		var remove=[];
		var i=0; var lim=children.length;
		while (i<lim) {
		    var child=children[i++];
		    if (child.nodeType!==1) continue;
		    else if (!(is_section(child))) {
			gatherSections(child,sections,docinfo);
			continue;}
		    else if ((hasClass(child,"codexwrapper"))&&
			     (just_whitespace(child))) {
			remove.push(child); continue;}
		    else if (!(hasContent(child,true,true))) {
			continue;}
		    // If there's nothing between it and the next section,
		    // skip it.
		    else if (no_preamble(child)) {
			gatherSections(child,sections,docinfo);}
		    else {
			var startid=getFirstID(child,docinfo);
			var endid=getLastID(child,docinfo);
			var startinfo=((startid)&&(docinfo[startid]));
			var endinfo=((startid)&&(docinfo[startid]));
			sections.push(child);
			child.setAttribute("data-sectnum",sections.length);
			if (startinfo) {
			    child.setAttribute("data-sbookloc",startinfo.starts_at);
			    child.setAttribute("data-topid",startid);}
			if ((startinfo)&&(endinfo)&&
			    (typeof startinfo.starts_at === 'number')&&
			    (typeof startinfo.ends_at === 'number'))
			    child.setAttribute(
				"data-sbooklen",endinfo.ends_at-startinfo.starts_at);
			gatherSections(child,sections,docinfo);}}
		var i=0; var lim=remove.length; while (i<lim)
		    removeSection(remove[i++]);
		return sections;}}

	function getFirstID(node,docinfo){
	    if ((node.id)&&(docinfo[node.id])) return node.id;
	    else if (node.nodeType!==1) return false;
	    else {
		var children=node.childNodes;
		var i=0; var lim=children.length;
		while (i<lim) {
		    var child=children[i++];
		    if (child.nodeType===1) {
			var id=getFirstID(child,docinfo);
			if (id) return id;}}
		return false;}}

	function getLastID(node,docinfo){
	    if ((node.id)&&(docinfo[node.id])) return node.id;
	    else if (node.nodeType!==1) return false;
	    else {
		var children=node.childNodes;
		var i=children.length-1;
		while (i>=0) {
		    var child=children[i--];
		    if (child.nodeType===1) {
			var id=getLastID(child,docinfo);
			if (id) return id;}}
		return false;}}

	function no_preamble(node){
	    var children=node.childNodes;
	    var i=0, lim=children.length;
	    while (i<lim) {
		var child=children[i++];
		if ((child.nodeType===3)&&
		    (!(emptyString(child.nodeValue))))
		    return false;
		else if ((child.nodeType===1)&&(is_section(child)))
		    return true;
		else if (child.nodeType===1)
		    return false;
		else {}}
	    return false;}
	Codex.no_preamble=no_preamble;

	/* Gathering page break offset locations in long (overflow)
	   sections */

	function getFirstContent(node){
	    var children=node.childNodes;
	    var i=0; var lim=children.length;
	    while (i<lim) {
		var child=children[i++];
		if (child.nodeType===1) return child;
		else if ((child.nodeType===3)&&
			 (!(emptyString(child.nodeValue))))
		    return child;}
	    return false;}

	function gatherFastBreaks(prev,node,container,
				  pagelim,height,
				  breaks,tops,
				  opts){
	    var style=getStyle(node);
	    var display=style.display;
	    var fudge=((opts)&&(opts.fudge))||0.25;
	    var scrollover=((opts)&&(opts.scrollover))||20;
	    if ((display==='block')||(display==='table-row')||
		(display==='list-item')||(display==='preformatted')) {
		var geom=getGeom(node,container);
		if (geom.bottom<pagelim)
		    return pagelim;
		else if ((geom.top>pagelim)&&(prev)&&
			 (avoidBreakAfter(prev))) {
		    var pgeom=getGeom(prev,container);
		    breaks.push(pgeom.top);
		    tops.push(prev);
		    if (geom.bottom>(pgeom.top+height))
			return gatherFastBreaks(
			    false,node,container,pagelim,height,
			    breaks,tops,opts);
		    else return pgeom.top+height;}
		else if (geom.top>pagelim) {
		    breaks.push(geom.top);
		    tops.push(node);
		    return geom.top+height;}
		else if ((style.pageBreakBefore==='always')||
			 (forceBreakBefore(node))) {
		    breaks.push(geom.top);
		    tops.push(node);
		    return geom.top+height;}
		else if (style.pageBreakInside==='avoid') {
		    // If it's the first element, we already pushed it's position
		    if (!((geom.top===0)||
			  (node===getFirstContent(tops[tops.length-1])))) {
			breaks.push(geom.top);
			tops.push(node);}
		    pagelim=geom.top+height;
		    while (pagelim<geom.bottom) {
			breaks.push(pagelim-scrollover);
			tops.push(false);
			pagelim=(pagelim-scrollover)+height;}
		    return pagelim;}
		else if ((pagelim-geom.top)<
			 ((fudge<1)?(fudge*height):(fudge))) {
		    // If it's at the top, we already pushed it's location
		    if (geom.top!==0) {
			if ((prev)&&(avoidBreakAfter(prev))) {
			    var pgeom=getGeom(prev,container);
			    breaks.push(pgeom.top);
			    tops.push(prev);
			    if (geom.bottom>(pgeom.top+height))
				return gatherFastBreaks(
				    false,node,container,pagelim,height,
				    breaks,tops,opts);
			    else pagelim=pgeom.top+height;}
			else {
			    breaks.push(geom.top);
			    tops.push(node);
			    pagelim=geom.top+height;}}
		    return gatherFastBreaks(prev,node,container,pagelim,height,
					    breaks,tops,opts);}
		else {
		    var children=node.childNodes; var last_child=prev;
		    var i=0, lim=children.length;
		    while (i<lim)  {
			var child=children[i++];
			if (child.nodeType===1) {
			    pagelim=gatherFastBreaks(
				last_child,child,container,
				pagelim,height,
				breaks,tops,
				opts);
			    last_child=child;}}
		    while (pagelim<geom.bottom) {
			breaks.push(pagelim-scrollover);
			tops.push(false);
			pagelim=(pagelim-scrollover)+height;}
		    return pagelim;}}
	    else return pagelim;}

	CodexSections.prototype.autoscale=1.25;
	CodexSections.prototype.scrollover=20;
	CodexSections.prototype.getPageBreaks=function(arg){
	    var section=((arg.nodeType)?(arg):(this.sections[arg]));
	    var autoscale=this.autoscale; var geom=false;
	    if (!(section)) return [];
	    var sectnum=((typeof arg === 'number')?(arg):
			 atoi(arg.getAttribute('data-sectnum')));
	    if (Codex.Trace.layout>1)
		fdjtLog("Computing %dpx-high pages for section %d (%o)",
			this.height,sectnum,section);
	    if (this.pagebreaks[sectnum-1])
		return this.pagebreaks[sectnum-1];
	    else if (section.offsetHeight===0) return false;
	    else if (section.offsetHeight<=this.height) {
		var breaks=[0];
		this.pagebreaks[sectnum-1]=breaks;
		this.pagetops[sectnum-1]=[section];
		return breaks;}
	    else if (hasClass(section,"codexscaled")) {
		var breaks=[0];
		this.pagebreaks[sectnum-1]=breaks;
		this.pagetops[sectnum-1]=[section];
		return breaks;}
	    else if ((autoscale)&&
		     (section.offsetHeight>this.height)&&
		     (section.offsetHeight<(this.height*autoscale))&&
		     (!(isTransformed(section)))) {
		// Use scaling to fit oversize pages if they're not
		// *too* oversize (as defined by autoscale).
		var scaling=(this.height*0.95)/section.offsetHeight;
		var breaks=[0];
		this.pagebreaks[sectnum-1]=breaks;
		this.pagetops[sectnum-1]=[section];
		addClass(section,"codexscaled");
		section.style[fdjtDOM.transformOrigin]='center top';
		section.style[fdjtDOM.transform]='scale('+scaling+')';
		return breaks;}
	    else {
		var breaks=[], tops=[];
		var placeholder=false;
		breaks.push(0); tops.push(section);
		var pagelim=gatherFastBreaks(
		    false,section,Codex.content,this.height,this.height,
		    breaks,tops,{scrollover: this.scrollover});
		this.pagebreaks[sectnum-1]=breaks;
		this.pagetops[sectnum-1]=tops;
		if (pagelim<this.height) {}
		else if (section.offsetHeight<pagelim) {
		    section.style.marginBottom=
			(pagelim+this.scrollover-section.offsetHeight)+"px";}
		else {}
		if (Codex.Trace.layout>1)
		    fdjtLog("Found %d %dpx-high pages for section %d (h=%o)",
			    breaks.length,this.height,sectnum,section,
			   section.offsetHeight);
		return breaks;}};

	// This generates page breaks in the background
	CodexSections.prototype.breakupPages=function(height,callback){
	    if (typeof height === 'undefined') height=this.height;
	    if ((height===this.height)&&(this.pagelocs))
		return this.pagelocs;
	    else {
		var sectioned=this;
		var pagebreaks=this.pagebreaks;
		var pagetops=this.pagetops;
		var pagelocs=[]; var pagenums=[];
		Codex.layout=this;
		if (Codex.Trace.layout)
		    fdjtLog("Computing page breaks across %d sections (height=%d)",
			    this.sections.length,height);
		fdjtTime.slowmap(function(section){
		    var sectnum=parseInt(section.getAttribute("data-sectnum"));
		    var breaks=pagebreaks[sectnum-1];
		    var startpage=pagelocs.length;
		    var parent=section.parentNode;
		    if (!(breaks)) {
			var placeholder=fdjtDOM("div");
			parent.insertBefore(placeholder,section);
			var ostyle=section.style;
			// Move it out of the way of any actual content
			section.style.position="absolute";
			section.style.visibility="hidden";
			section.style.overflow="visible";
			section.style.display="block";
			section.style.zIndex=-500;
			Codex.content.appendChild(section);
			breaks=sectioned.getPageBreaks(section);
			// Put it back into the content stream
			section.style.position="";
			section.style.visibility="";
			section.style.overflow="";
			section.style.display="";
			section.style.zIndex="";
			parent.replaceChild(section,placeholder);}
		    var tops=pagetops[sectnum-1], pages=[];
		    var i=0; var lim=breaks.length;
		    while (i<lim) {
			pagelocs.push({section: section, off: breaks[i],
				       breaks: breaks, tops: tops,
				       sectnum: sectnum,pageoff: i,
				       pagenum: pagelocs.length+1});
			pages.push(pagelocs.length);
			i++;}
		    if (Codex.Trace.layout>1)
			if (breaks.length===1)
			    fdjtLog("Added one page (%d) for section %d (%o)",
				    pagelocs.length,sectnum,section);
		    else fdjtLog("Added %d pages (%d-%d) for section %d (%o)",
				 breaks.length,startpage+1,pagelocs.length,
				 sectnum,section);
		    pagenums[sectnum-1]=pages;},
				 this.sections,
				 false,
				 function(){
				     sectioned.height=height;
				     sectioned.pagelocs=pagelocs;
				     sectioned.pagenums=pagenums;
				     Codex.layout.done=fdjtTime();
				     fdjtLog("Added %d pages for %d sections",
					     sectioned.pagelocs.length,
					     sectioned.sections.length);
				     if (callback) callback(sectioned);},
				 100);}};
			 
	CodexSections.prototype.getPageNumber=function(section,offset){
	    if (typeof section==='undefined') section=Codex.section;
	    else if (typeof section === 'number')
		section=Codex.sections[section-1];
	    else if (section.nodeType===1) section=section;
	    else if (typeof offset === 'undefined') {
		var info=getSectionInfo(section);
		var pagenums=Codex.layout.pagenums[info.sectnum-1];
		return pagenums[info.pageoff];}
	    else section=getSection(section);
	    if (typeof offset === 'undefined') offset=Codex.window.scrollTop;
	    var sectnum=sectNum(section);
	    if (!(sectnum)) return false;
	    var breaks=Codex.layout.pagebreaks[sectnum-1];
	    var pagenums=Codex.layout.pagenums[sectnum-1];
	    var i=1, lim=breaks.length; while (i<lim) {
		if (offset<breaks[i]) return pagenums[i-1];
		else i++;}
	    return pagenums[i-1];}

	/* Movement by pages */
	
	var cursection=false;
	
	var forwardElt=fdjtDOM.forwardElt;

	function sectNum(section){
	    if (section.getAttribute("data-sectnum"))
		return parseInt(section.getAttribute("data-sectnum"));
	    var parent=section.parentNode;
	    if ((parent.getAttribute("data-sectnum"))&&
		(forwardElt(parent)===section))
		return parent.getAttribute("data-sectnum");
	    var first_child=forwardElt(section);
	    if (first_child.getAttribute("data-sectnum"))
		return first_child.getAttribute("data-sectnum");
	    else return false;}
	function sectLoc(section){
	    if (section.getAttribute("data-sectloc"))
		return parseInt(section.getAttribute("data-sectloc"));
	    var parent=section.parentNode;
	    if ((parent.getAttribute("data-sectloc"))&&
		(forwardElt(parent)===section))
		return parent.getAttribute("data-sectloc");
	    var first_child=forwardElt(section);
	    if (first_child.getAttribute("data-sectloc"))
		return first_child.getAttribute("data-sectloc");
	    else return false;}

	function getSectionInfo(spec,caller){
	    var sectioned=Codex.layout;
	    if (typeof spec === "number") {
		if ((sectioned.pagebreaks)&&
		    (sectioned.pagebreaks[spec-1]))
		    return {section: Codex.sections[spec-1], off: 0,
			    breaks: sectioned.pagebreaks[spec-1],
			    tops: sectioned.pagetops[spec-1],
			    pagenum: ((sectioned.pagenums)&&
				      (sectioned.pagenums[spec-1][0])),
			    pageoff: 0};
		else return {section: Codex.sections[spec-1], off: 0};}
	    if (typeof spec === "string") spec=fdjtID(spec);
	    if ((spec)&&(spec.section)&&(spec.section.nodeType)) {
		// Appears to be a section info object already
		if ((!(spec.breaks))&&(spec.section.offsetHeight)) {
		    // We have an opportunity to compute breaks
		    var breaks=sectioned.getPageBreaks(spec.section);
		    var sectnum=spec.sectnum||sectNum(spec.section);
		    spec.breaks=breaks; spec.sectnum=sectnum;
		    spec.tops=sectioned.pagetops[sectnum-1];
		    if ((spec.pageoff)&&(spec.pageoff<0))
			spec.off=breaks[breaks.length+spec.pageoff];
		    else if (sectioned.pagenums)
			spec.pagenum=sectioned.pagenums[
			    sectnum-1][spec.pageoff||0];
		    else {}
		    return spec;}
		else return spec;}
	    else if ((spec)&&(spec.nodeType)) {
		if (spec.tagName==='SECTION') {
		    var sectnum=sectNum(spec), location=sectLoc(spec);
		    return {section: spec, off: 0,target: spec,
			    sectnum: sectnum, location: location,
			    pagenum: ((sectioned.pagelocs)&&
				      (sectioned.pagelocs[sectnum-1][0])),
			    pageoff: 0};}
		else {
		    var scan=spec, box=false;
		    while (scan) {
			if ((box===false)&&(typeof scan.offsetTop === 'number'))
			    box=scan;
			if (scan.tagName==='SECTION') {
			    var info=((Codex.docinfo)&&
				      ((Codex.docinfo[spec.id])||
				       ((box)&&(Codex.docinfo[box.id]))));
			    var sectnum=sectNum(scan);
			    if ((box)&&(box.offsetHeight)) {
				var breaks=sectioned.pagebreaks[sectnum-1]||
				    sectioned.getPageBreaks(scan);
				var off=getGeom(spec,Codex.content).top;
				var location=((info)&&(info.starts_at))||
				    sectLoc(scan);
				var tops=sectioned.pagetops[sectnum-1];
				var i=1, lim=breaks.length;
				while (i<lim) {
				    if ((off>=breaks[i-1])&& (off<breaks[i]))
					break;
				    else i++;}
				return {section: scan,
					box: box,target: spec,
					breaks: breaks, tops: tops,
					pageoff:i-1, off: breaks[i-1],
					pagenum:
					((sectioned.pagenums)&&
					 (sectioned.pagenums[sectnum-1][i-1])),
					location: location};}
			    else if (box) 
				return {section: scan,
					box: box,target: spec,
					location: info.location};
			    else return {section: scan, target: spec,
					 off: 0,location:sectLoc(scan)};}
			else scan=scan.parentNode;}
		    return false;}}
	    else return false;}
	Codex.getSectionInfo=getSectionInfo;
	function getSection(){
	    var info=getSectionInfo(spec);
	    return ((info)&&(info.section));}
	Codex.getSection=getSection;
	
	function displaySection(sect,visible){
	    if ((!(sect.getAttribute("data-sectnum")))&&
		((fdjtDOM.forwardElt(sect)).getAttribute("data-sectnum"))) 
		sect=fdjtDOM.forwardElt(sect);
	    if (visible) {
		var show=sect;
		addClass(show,"codexvisible");
		show=show.parentNode;
		while (show) {
		    addClass(show,"codexlive");
		    show=show.parentNode;}
		return sect;}
	    else {
		var hide=sect;
		dropClass(hide,"codexvisible");
		hide=hide.parentNode;
		while (hide) {
		    dropClass(hide,"codexlive");
		    hide=hide.parentNode;}
		return false;}}
	Codex.displaySection=displaySection;
	
	function GoToSection(spec,caller,pushstate){
	    if (typeof pushstate === 'undefined') pushstate=false;
	    if (Codex.previewing) stopPreview("GoToSection");
	    var info=getSectionInfo(spec)||getSectionInfo(1);
	    if (!(info)) {
		fdjtLog("Warning: GoToSection couldn't map %o to section for %s",
			spec,caller);
		return;}
	    var section=info.section; var sectnum=sectNum(section);
	    if (Codex.Trace.flips)
		fdjtLog("GoToSection/%s Flipping to %o (%d) from %o for %o",
			caller,section,sectnum,cursection,spec);
	    if (cursection) displaySection(cursection,false);
	    cursection=displaySection(section,true);
	    // Now that the section is visible, we can get more information,
	    //  so we call getSectionInfo again.  A little kludgy but
	    //  better than the alternatives given that we're hiding sections.
	    info=getSectionInfo(spec);
	    if (info.location) Codex.setLocation(location);
	    Codex.section=cursection; Codex.cursect=sectnum;
	    if (info.pagenum) Codex.curpage=info.pagenum;
	    var win=Codex.window; var pageoff=info.pageoff;
	    var breaks=info.breaks; var tops=info.tops;
	    win.scrollTop=info.off;
	    if ((tops)&&(tops[pageoff+1])) {
		// Make the winmask be opaque to hide 'offpage'
		// content because the next page has it's own 'top'.
		Codex.winmaskhead.style.height='0px';
		Codex.winmaskfoot.style.opacity=1.0;
		Codex.winmaskfoot.style.backgroundColor=
		    Codex.backgroundColor||'white';}
	    else {
		Codex.winmaskfoot.style.opacity='';
		Codex.winmaskfoot.style.backgroundColor='';}
	    if ((breaks)&&(breaks.length>1)) {
		// Make the winmask opaque to guide paging
		if (pageoff<(breaks.length-1)) {
		    var footheight=((breaks[pageoff]+win.offsetHeight)-
				    (breaks[pageoff+1]));
		    Codex.winmaskfoot.style.top=breaks[pageoff+1]+"px";
		    Codex.winmaskfoot.style.height=footheight+"px";}
		else Codex.winmaskfoot.style.height="0px";
		if (pageoff>0) {
		    var headheight=((breaks[pageoff-1]+win.offsetHeight)-
				    (breaks[pageoff]));
		    Codex.winmaskhead.style.top=info.off+"px";
		    Codex.winmaskhead.style.height=headheight+"px";}
		else Codex.winmaskhead.style.height="0px";}
	    else {
		Codex.winmaskfoot.style.height='0px';
		Codex.winmaskhead.style.height='0px';}
	    if ((info.pagenum)&&(Codex.layout.pagelocs)) 
		Codex.updatePageDisplay(info.pagenum,info.location);
	    if ((pushstate)&&(section)) {
		Codex.setState(
		    {location: atoi(section.getAttribute("data-sbookloc")),
		     target: section.getAttribute("data-topid")});}
	    var glossed=fdjtDOM.$(".glossed",section);
	    if (glossed) {
		var addGlossmark=Codex.UI.addGlossmark;
		var i=0; var lim=glossed.length;
		while (i<lim) addGlossmark(glossed[i++]);}}
	Codex.GoToSection=GoToSection;
	
	var previewing=false;
	var saved_scrolltop=false;
	function startPreview(spec,caller){
	    var info=getSectionInfo(spec);
	    var section=info.section;
	    var target=((spec.nodeType)?(spec):
			(typeof spec === 'string')?(fdjtID(spec)):
			(false));
	    if (!(section)) return;
	    var sectnum=parseInt(section.getAttribute("data-sectnum"));;
	    if (previewing===section) return;
	    if (Codex.Trace.flips)
		fdjtLog("startSectionPreview/%s to %o (%d) for %o",
			caller||"nocaller",section,sectnum,spec);
	    if (previewing) displaySection(previewing,false);
	    else {
		displaySection(cursection,false);
		addClass(document.body,"cxPREVIEW");
		saved_scrolltop=Codex.window.scrollTop;}
	    Codex.previewing=previewing=section;
	    displaySection(section,true);
	    // Recompute info now that it's displayed
	    info=getSectionInfo(spec);
	    Codex.window.scrollTop=(info.off)||0;
	    addClass(document.body,"cxPREVIEW");
	    if (info.pagenum)
		Codex.updatePageDisplay(info.pagenum,info.location);
	    return;}
	Codex.startSectionPreview=startPreview;

	function stopPreview(caller){
	    var sectnum=parseInt(cursection.getAttribute("data-sectnum"));
	    if (Codex.Trace.flips)
		fdjtLog("stopSectionPreview/%s from %o to %o (%d)",
			caller||"nocaller",previewing,cursection,sectnum);
	    if (!(previewing)) return;
	    displaySection(previewing,false);
	    displaySection(cursection,true);
	    if (saved_scrolltop) {
		Codex.window.scrollTop=saved_scrolltop;
		saved_scrolltop=false;}
	    dropClass(document.body,"cxPREVIEW");
	    if (Codex.previewTarget) {
		var ptarget=Codex.previewTarget;
		var nodes=Codex.getDups(ptarget);
		dropClass(nodes,"codexpreviewtarget");
		Codex.clearHighlights(nodes);
		Codex.previewTarget=false;}
	    Codex.previewing=previewing=false;
	    if (Codex.curpage)
		Codex.updatePageDisplay(Codex.curpage,Codex.location);
	    return;}
	Codex.stopSectionPreview=stopPreview;

	return CodexSections;})();
	    
var CodexPaginate=
    (function(){

	var getGeometry=fdjtDOM.getGeometry;
	var getParent=fdjtDOM.getParent;
	var hasClass=fdjtDOM.hasClass;
	var addClass=fdjtDOM.addClass;
	var dropClass=fdjtDOM.dropClass;
	var TOA=fdjtDOM.toArray;
	var isEmpty=fdjtString.isEmpty;
	var secs2short=fdjtTime.secs2short;
	var rootloop_skip=50;
	
	var atoi=parseInt;

	function Paginate(why,init){
	    
	    if (((Codex.layout)&&(!(Codex.layout.done)))) return;
	    if (!(why)) why="because";
	    if (Codex.layout) {
		Codex.layout.Revert();
		Codex.layout=false;}
	    addClass(document.body,"cxLAYOUT");
	    var height=getGeometry(fdjtID("CODEXPAGE")).height;
	    var width=getGeometry(fdjtID("CODEXPAGE")).width;
	    var bodysize=Codex.bodysize||"normal";
	    var bodyfamily=Codex.bodyfamily||"serif";
	    if (Codex.layout) {
		var current=Codex.layout;
		if ((!(init.forced))&&
		    (width===current.page_width)&&
		    (height===current.page_height)&&
		    (bodysize===current.bodysize)&&
		    (bodyfamily===current.bodyfamily)) {
		    fdjtLog("Skipping redundant pagination %j",current);
		    return;}
		// Repaginating, start with reversion
		Codex.layout.Revert();
		Codex.layout=false;}

	    // Create a new layout
	    var layout=new CodexLayout(getLayoutArgs());
	    layout.bodysize=bodysize; layout.bodyfamily=bodyfamily;
	    Codex.layout=layout;
	    
	    // Prepare to do the layout
	    dropClass(document.body,"cxSCROLL");
	    dropClass(document.body,"cxBYSECT");
	    addClass(document.body,"cxBYPAGE");
	    fdjtID("CODEXPAGE").style.visibility='hidden';
	    fdjtID("CODEXCONTENT").style.visibility='hidden';
	    
	    // Now walk the content
	    var content=Codex.content;
	    var nodes=TOA(content.childNodes);
	    fdjtLog("Laying out %d root nodes into %dx%d pages (%s)",
		    nodes.length,layout.width,layout.height,
		    (why||""));

	    // Get the document info
	    var docinfo=Codex.docinfo;

	    /* Lay out the coverpage */
	    var coverpage=Codex.getCover();
	    if (coverpage) layout.addContent(coverpage);
	    
	    var textWidth=fdjtDOM.textWidth;
	    var hasText=fdjtDOM.hasText;


	    function getPageTop(node) {
		if (hasClass(node,"codexpage")) {}
		else if ((node.id)&&(docinfo[node.id])) {
		    if (hasText(node)) return node;}
		else if ((node.codexbaseid)&&(docinfo[node.codexbaseid])) {
		    if (hasText(node)) return node;}
		else {}
		var children=node.childNodes;
		if (children) {
		    var i=0; var lim=children.length;
		    while (i<lim) {
			var child=children[i++];
			if (child.nodeType===1) {
			    var first=getPageTop(child);
			    if (first) return first;}}}
		return false;}

	    function getDupNode(under,id){
		var children;
		if (under.nodeType!==1) return false;
		else if (under.codexbaseid===id) return under;
		if (!(children=under.childNodes))
		    return false;
		else if (!(children.length)) return false;
		else {
		    var i=0, lim=children.length;
		    while (i<lim) {
			var found=getDupNode(children[i++],id);
			if (found) return found;}}}

	    function getLocOff(pages,topstart,topnode){
		var id=topstart.id; var locoff=0;
		var pagescan=topstart, pagenum, elt=topstart;
		while (pagescan) {
		    if (hasClass(pagescan,"codexpage")) {
			break;}
		    else pagescan=pagescan.parentNode;}
		if (!(pagescan)) return locoff;
		else pagenum=parseInt(pagescan.getAttribute("data-pagenum"));
		while ((elt)&&(elt!==topnode)) {
		    var width=textWidth(elt);
		    if (width) locoff=locoff+width;
		    pagescan=pages[++pagenum];
		    if (pagescan) elt=getDupNode(pagescan,id);}
		return locoff;}
		
	    function getPageTops(pages){
		var j=0, jlim=pages.length, running=0;
		while (j<jlim) {
		    var page=pages[j++];
		    var topnode=getPageTop(page);
		    if (topnode) {
			var topstart=document.getElementById(
			    topnode.codexbaseid||topnode.id);
			var locoff=((topstart===topnode)?(0):
				    (getLocOff(pages,topstart,topnode)));
			var id=topstart.id; var info=docinfo[id];
			page.setAttribute("data-topid",id);
			page.setAttribute(
			    "data-sbookloc",info.starts_at+locoff);
			running=info.starts_at+locoff;}
		    else {
			page.setAttribute("data-sbookloc",running);}}}

	    var i=0; var lim=nodes.length;
	    function rootloop(){
		if (i>=lim) {
		    layout.Finish();
		    layout_progress(layout);
		    var pages=layout.pages;
		    getPageTops(layout.pages);
		    fdjtID("CODEXPAGE").style.visibility='';
		    fdjtID("CODEXCONTENT").style.visibility='';
		    dropClass(document.body,"cxLAYOUT");
		    Codex.layout=layout;
		    Codex.pagecount=layout.pages.length;
		    if (Codex.pagewait) {
			var fn=Codex.pagewait;
			Codex.pagewait=false;
			fn();}
		    Codex.GoTo(
			Codex.location||Codex.target||
			    Codex.cover||Codex.titlepage||
			    fdjtID("CODEXPAGE1"),
			"endLayout",false,false);
		    Codex.layout.running=false;}
		else {
		    var root=nodes[i++];
		    var timeslice=layout.timeslice||CodexLayout.timeslice||200;
		    var timeskip=layout.timeskip||CodexLayout.timeskip||50;
		    if (((root.nodeType===3)&&(!(isEmpty(root.nodeValue))))||
			((root.nodeType===1)&&
			 (root.tagName!=='LINK')&&(root.tagName!=='META')&&
			 (root.tagName!=='SCRIPT')&&(root.tagName!=='BASE'))) 
			layout.addContent(root,timeslice,timeskip,
					  layout.tracelevel,
					  layout_progress,rootloop);
		    else rootloop();}}

	    	/* Reporting progress, debugging */
	
	    function layout_progress(info){
		var tracelevel=info.tracelevel;
		var started=info.started;
		var pagenum=info.pagenum;
		var now=fdjtTime();
		if (!(pagenum)) return;
		if (info.done) {
		    LayoutMessage(fdjtString(
			"Finished laying out %d %dx%d pages in %s",
			pagenum,
			secs2short((info.done-info.started)/1000)));
		    fdjtLog("Finished laying out %d %dx%d pages in %s",
			    pagenum,info.width,info.height,
			    secs2short((info.done-info.started)/1000));}
		else {
		    if ((info.lastid)&&(Codex.docinfo)&&
			((Codex.docinfo[info.lastid]))) {
			var docinfo=Codex.docinfo;
			var maxloc=docinfo._maxloc;
			var lastloc=docinfo[info.lastid].starts_at;
			var pct=(100*lastloc)/maxloc;
			fdjtUI.ProgressBar.setProgress("CODEXLAYOUTMESSAGE",pct);
			LayoutMessage(fdjtString(
			    "Laid out %d pages (%d%%) in %s",
			    pagenum,Math.floor(pct),
			    secs2short((now-started)/1000)));
			if (tracelevel)
			    fdjtLog("Laid out %d pages (%d%%) in %s",
				    pagenum,Math.floor(pct),
				    secs2short((now-started)/1000));}
		    else {
			LayoutMessage(fdjtString(
			    "Laid out %d pages in %s",
			    info.pagenum,secs2short((now-started)/1000)));
			if (tracelevel)
			    fdjtLog("Laid out %d pages in %s",
				    info.pagenum,secs2short((now-started)/1000));}}}
	
	    function LayoutMessage(msg){
		fdjtUI.ProgressBar.setMessage("CODEXLAYOUTMESSAGE",msg);}
	    
	    rootloop();}
	Codex.Paginate=Paginate;

	CodexLayout.prototype.onresize=function(evt){
	    var content=Codex.content; var page=Codex.page;
	    var page_width=fdjtDOM.getGeometry(page).width;
	    var content_width=fdjtDOM.getGeometry(content).width;
	    var view_width=fdjtDOM.viewWidth();
	    var view_height=fdjtDOM.viewHeight();
	    var page_margin=(view_width-page_width)/2;
	    var content_margin=(view_width-content_width)/2;
	    if (page_margin!==50) {
		page.style.left=page_margin+'px';
		page.style.right=page_margin+'px';}
	    else page.style.left=page.style.right='';
	    if (content_margin!==50) {
		content.style.left=content_margin+'px';
		content.style.right=content_margin+'px';}
	    else content.style.left=content.style.right='';
	    fdjtID("CODEXHEART").style.maxHeight=(view_height-100)+'px';
	    if (Codex.bypage) Codex.Paginate("resize");};
	
	Codex.addConfig(
	    "layout",
	    function(name,val){
		Codex.page_style=val;
		if (val==='bypage') {
		    if (!(Codex.docinfo)) {
			// If there isn't any docinfo (during startup, for
			// instance), don't bother actually paginating.
			Codex.bypage=true;}
		    else if (!(Codex.bypage)) {
			// set this
			Codex.bypage=true;
			if (Codex.postconfig)
			    // If we're in the middle of config,
			    // push off the work of paginating
			    Codex.postconfig.push(Paginate);
			// Otherwise, paginate away
			else Codex.Paginate("config");}}
		else {
		    // If you've already paginated, revert
		    if (Codex.layout) {
			Codex.layout.Revert();
			Codex.layout=false;}
		    else if (((Codex.layout)&&(!(Codex.layout.done)))) {
			if (Codex.layout.timer) {
			    clearTimeout(Codex.layout.timer);
			    Codex.layout.timer=false;}
			Codex.layout.Revert();
			Codex.layout=false;}
		    else {}
		    if ((val==='bysect')||(val==='fastpage')||(val==='byspage')) {
			dropClass(document.body,"cxBYPAGE");
			dropClass(document.body,"cxSCROLL");
			addClass(document.body,"cxBYSECT");
			if (Codex.docinfo) {
			    Codex.layout=new CodexSections(
				Codex.content,Codex.docinfo);
			    Codex.sections=Codex.layout.sections;}
			Codex.bypage=false;
			Codex.bysect=true;}
		    else {
			Codex.bypage=false;
			Codex.bysect=false;
			if (Codex.layout) {
			    Codex.layout.Revert();
			    Codex.layout=false;}
			dropClass(document.body,"cxBYPAGE");
			dropClass(document.body,"cxBYSECT");
			addClass(document.body,"cxSCROLL");}}});

	function updateLayoutProperty(name,val){
	    // This updates layout properties
	    fdjtDOM.swapClass(
		Codex.page,new RegExp("codex"+name+"\w*"),"codex"+name+val);
	    Codex[name]=val;
	    if (Codex.layout) {
		// If you're already paginated, repaginate.  Either
		// when done with the config or immediately.
		if (Codex.postconfig) {
		    Codex.postconfig.push(function(){
			CodexMode(true);
			Codex.Paginate(name);});}
		else {
		    CodexMode(true);
		    Codex.Paginate(name);}}}
	Codex.addConfig("bodysize",updateLayoutProperty);
	Codex.addConfig("bodyfamily",updateLayoutProperty);
	
	function getLayoutArgs(){
	    var height=getGeometry(fdjtID("CODEXPAGE"),false,true).inner_height;
	    var width=getGeometry(fdjtID("CODEXPAGE"),false,true).width;
	    var container=fdjtDOM("div.codexpages#CODEXPAGES");
	    var pagerule=fdjtDOM.addCSSRule(
		"div.codexpage",
		"width: "+width+"px; "+"height: "+height+"px;");
	    var args={page_height: height,page_width: width,
		      container: container,pagerule: pagerule,
		      tracelevel: Codex.Trace.layout,
		      logfn: fdjtLog};
	    fdjtDOM.replace("CODEXPAGES",container);
	    
	    var avoidbreakinside=
		fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakinside",true));
	    if (avoidbreakinside) args.avoidbreakinside=avoidbreakinside;

	    var forcebreakbefore=
		fdjtDOM.sel(fdjtDOM.getMeta("forcebreakbefore",true));
	    if (forcebreakbefore) args.forcebreakbefore=forcebreakbefore;

	    var forcebreakafter=
		fdjtDOM.sel(fdjtDOM.getMeta("forcebreakafter",true));
	    if (forcebreakafter) args.forcebreakafter=forcebreakafter;

	    var avoidbreakafter=
		fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakafter",true));
	    if (avoidbreakafter) args.avoidbreakafter=avoidbreakafter;

	    var avoidbreakbefore=
		fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakbefore",true));
	    if (avoidbreakbefore) args.avoidbreakbefore=avoidbreakbefore;
	    
	    var fullpages=fdjtDOM.sel(fdjtDOM.getMeta("sbookfullpage",true));
	    if (fullpages) fullpages.push("sbookfullpage");
	    else fullpages=["sbookfullpage"];
	    args.fullpages=fullpages;
	    
	    var floatpages=fdjtDOM.sel(fdjtDOM.getMeta("sbookfloatpage",true));
	    if (floatpages) floatpages.push("sbookfloatpage");
	    else floatpages=["sbookfloatpage"];
	    args.floatpages=floatpages;

	    if ((fdjtDOM.getMeta("Codex.dontbreakblocks"))||
		(fdjtDOM.getMeta("Codex.keepblocks"))||
	       	(fdjtDOM.getMeta("~=Codex.dontbreakblocks"))||
		(fdjtDOM.getMeta("~=Codex.keepblocks"))||
		(fdjtDOM.getMeta("~dontbreakblocks"))||
		(fdjtDOM.getMeta("~keepblocks")))
		args.break_blocks=false;
	    else args.break_blocks=true;
	    
	    if ((fdjtDOM.getMeta("Codex.dontscalepages"))||
		(fdjtDOM.getMeta("~=Codex.dontscalepages"))||
		(fdjtDOM.getMeta("dontscalepages")))
		args.scale_pages=false;
	    else args.scale_pages=true;

	    return args;}
	CodexLayout.getLayoutArgs=getLayoutArgs;

	/* Updating the page display */

	function updatePageDisplay(pagenum,location) {
	    var npages=Codex.pagecount;
	    var pbar=fdjtDOM("div.progressbar#CODEXPROGRESSBAR");
	    var book_len=Codex.ends_at;
	    
	    pbar.style.left=(100*((pagenum-1)/npages))+"%";
	    pbar.style.width=(100/npages)+"%";
	    var locoff;
	    if (typeof location==='number') {
		var max_loc=Codex.ends_at;
		var pct=(100*location)/max_loc;
		// This is (very roughly) intended to be the precision needed
		//  for line level (40 character) accuracy.
		var prec=Math.round(Math.log(max_loc/40)/Math.log(10))-2;
		if (prec<0) prec=0;
		locoff=fdjtDOM(
		    "span.locoff#CODEXLOCOFF",
		    fdjtString.precString(pct,prec)+"%");
		locoff.title=location+"/"+max_loc;}
	    else locoff=fdjtDOM("span.locoff#CODEXLOCOFF");
	    var pageno_text=fdjtDOM(
		"span#CODEXPAGENOTEXT.pageno",pagenum,"/",npages);
	    fdjtDOM.replace("CODEXPAGENOTEXT",pageno_text);
	    fdjtDOM.replace("CODEXLOCOFF",locoff);
	    // var pageno=fdjtDOM("div#CODEXPAGENO",locoff,pageno_text);
	    // fdjtDOM.replace("CODEXPAGENO",pageno);
	    fdjtDOM.replace("CODEXPROGRESSBAR",pbar);
	    locoff.title=
		((locoff.title)||"")+
		((locoff.title)?("; "):(""))+
		"click to jump to a percentage location in the book";
	    fdjtDOM.addListeners(
		locoff,Codex.UI.handlers[Codex.ui]["#CODEXLOCOFF"]);
	    pageno_text.title="click to jump to a particular page";
	    fdjtDOM.addListeners(
		pageno_text,Codex.UI.handlers[Codex.ui]["#CODEXPAGENOTEXT"]);}
	
	/* Movement by pages */
	
	var curpage=false;
	
	function GoToPage(spec,caller,pushstate){
	    if (typeof pushstate === 'undefined') pushstate=false;
	    if (Codex.previewing) stopPreview("GoToPage");
	    dropClass(document.body,"codexhelp");
	    if ((Codex.layout)&&
		(Codex.layout.pagelocs)) {
		Codex.GoToSection(Codex.layout.pagelocs[spec-1]);
		if (Codex.iscroll) Codex.iscroll.refresh();}
	    else if (Codex.layout) {
		var page=Codex.layout.getPage(spec)||
		    Codex.layout.getPage(1);
		var pagenum=parseInt(page.getAttribute("data-pagenum"));
		if (Codex.Trace.flips)
		    fdjtLog("GoToPage/%s Flipping to %o (%d) for %o",
			    caller,page,pagenum,spec);
		if (curpage) dropClass(curpage,"curpage");
		addClass(page,"curpage");
		if (typeof spec === 'number') {
		    var location=parseInt(page.getAttribute("data-sbookloc"));
		    Codex.setLocation(location);}
		updatePageDisplay(pagenum,Codex.location);
		curpage=page; Codex.curpage=pagenum;
		if (pushstate) {
		    var curnode=fdjtID(page.getAttribute("data-topid"));
		    Codex.setHead(curnode);}
		if ((pushstate)&&(page)) {
		    Codex.setState(
			{location: atoi(page.getAttribute("data-sbookloc")),
			 page: atoi(page.getAttribute("data-pagenum")),
			 target: Codex.target.id});}
		var glossed=fdjtDOM.$(".glossed",page);
		if (glossed) {
		    var addGlossmark=Codex.UI.addGlossmark;
		    var i=0; var lim=glossed.length;
		    while (i<lim) addGlossmark(glossed[i++]);}}}
	Codex.GoToPage=GoToPage;
	

	/** Previewing **/

	var previewing=false;
	function startPreview(spec,caller){
	    if ((Codex.layout)&&(Codex.layout.pagelocs)) {
		if (typeof spec === 'number') 
		    Codex.startSectionPreview(
			Codex.layout.pagelocs[spec-1],caller);
		else Codex.startSectionPreview(spec,caller);
		return;}
	    var page=((spec.nodeType)&&(getParent(spec,".codexpage")))||
		Codex.layout.getPage(spec)||
		Codex.layout.getPage(1);
	    var pagenum=parseInt(page.getAttribute("data-pagenum"));
	    if (previewing===page) return;
	    if (previewing) dropClass(previewing,"curpage");
	    if (Codex.Trace.flips)
		fdjtLog("startPagePreview/%s to %o (%d) for %o",
			caller||"nocaller",page,pagenum,spec);
	    if (curpage) dropClass(curpage,"curpage");
	    else {
		var curpages=fdjtDOM.$(".curpage");
		if ((curpages)&&(curpages.length))
		    dropClass(curpages,"curpage");}
	    addClass(page,"curpage");
	    Codex.previewing=previewing=page;
	    addClass(document.body,"cxPREVIEW");
	    updatePageDisplay(pagenum,Codex.location);}
	function stopPreview(caller){
	    if ((Codex.layout)&&(Codex.layout.pagelocs)) {
		Codex.stopSectionPreview(caller);
		return;}
	    var pagenum=parseInt(curpage.getAttribute("data-pagenum"));
	    if (Codex.Trace.flips)
		fdjtLog("stopPagePreview/%s from %o to %o (%d)",
			caller||"nocaller",previewing,curpage,pagenum);
	    if (!(previewing)) return;
	    dropClass(previewing,"curpage");
	    addClass(curpage,"curpage");
	    Codex.previewing=previewing=false;
	    dropClass(document.body,"cxPREVIEW");
	    updatePageDisplay(pagenum,Codex.location);}
	Codex.startPagePreview=startPreview;
	Codex.stopPagePreview=stopPreview;

	Codex.updatePageDisplay=updatePageDisplay;

	function getPage(arg){
	    if ((Codex.bysect)&&(Codex.layout.pagelocs)) 
		return Codex.layout.getPageNumber(arg);
	    else if (!(Codex.layout)) return -1;
	    var node=((arg.nodeType)?(arg):
		      (typeof arg === "string")?
		      (fdjtID(arg)):(false));
	    var page=Codex.layout.getPage(arg)||Codex.layout.getPage(1);
	    return parseInt(page.getAttribute("data-pagenum"));}
	Codex.getPage=getPage;
	
	function displaySync(){
	    if ((Codex.pagecount)&&(Codex.curpage))
		Codex.GoToPage(Codex.curpage,"displaySync");}
	Codex.displaySync=displaySync;

	return Paginate;})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
