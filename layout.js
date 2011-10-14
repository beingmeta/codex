/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

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

var CodexLayout=
    (function(){

	var tocmajor=false;

	function testNode(node,test) {
	    var tests;
	    if (!(test)) return true;
	    if (typeof test === 'string') tests=[test];
	    else if (test instanceof Array) tests=test;
	    else tests=[test];
	    var i=0; var lim=tests.length;
	    while (i<lim) {
		var atest=tests[i++];
		if (node===test) return true;
		else if (typeof atest === 'string') {
		    if (!(node.className)) continue;
		    var classrx=new Regexp("\b"+atest+"\b");
		    if (node.className.search(classrx)>=0) return true;}
		else if ((atest.match)&&(atest.match(node)))
		    // This should get most versions of CSS selectors
		    return true;
		else {}}
	    return false;}

	var isEmpty=fdjtString.isEmpty;
	var hasContent=fdjtDOM.hasContent;
	var getGeometry=fdjtDOM.getGeometry;
	var getDisplay=fdjtDOM.getDisplay;
	var hasParent=fdjtDOM.hasParent;
	var getParent=fdjtDOM.getParent;
	var getStyle=fdjtDOM.getStyle;
	var parsePX=fdjtDOM.parsePX;
	var geomString=fdjtDOM.geomString;
	var insertBefore=fdjtDOM.insertBefore;
	var hasClass=fdjtDOM.hasClass;
	var addClass=fdjtDOM.addClass;
	var dropClass=fdjtDOM.dropClass;
	var nextElt=fdjtDOM.nextElt;
	var forward=fdjtDOM.forward;
	var TOA=fdjtDOM.toArray;
	
	function insideBounds(box){
	    var top=false, right=false, bottom=false, left=false;
	    function gatherBounds(node){
		if ((!(node))||(node.nodeType!==1)) return;
		var style=getStyle(node); var children;
		if ((style.position==='static')&&
		    ((node.tagName==='img')||(style.display!=='inline'))) {
		    var geom=getGeometry(node,box);
		    if ((left===false)||(geom.left<left)) left=geom.left;
		    if ((top===false)||(geom.top<top)) top=geom.top;
		    if ((right===false)||(geom.right>right)) right=geom.right;
		    if ((bottom===false)||(geom.bottom>bottom))
			bottom=geom.bottom;}
		if ((children=node.childNodes)&&(children.length)) {
		    var i=0; var len=children.length;
		    while (i<len) gatherBounds(children[i++]);}}
	    var nodes=box.childNodes;
	    var j=0; var jlim=nodes.length;
	    while (j<jlim) gatherBounds(nodes[j++]);
	    return { left: left, top: top, right: right, bottom: bottom,
		     width: right-left, height: bottom-top};}
	
	/* Scaling things */
	
	function scaleImage(image,scale,geom){
	    if (!(geom)) geom=getGeometry(image);
	    // Set image width/height explicitly rather than
	    // scaling because that's more portable
	    var w=Math.round(geom.width*scale);
	    var h=Math.round(geom.height*scale);
	    image.width=image.style.width=
		image.style['max-width']=image.style['min-width']=w;
	    image.height=image.style.height=
		image.style['max-height']=image.style['min-height']=h;
	    addClass(image,"codextweaked");}
	
	/* Codex trace levels */
	/* 0=notrace (do final summary if tracing startup)
	   1=trace repagination chunk by chunk
	   2=trace inserted page breaks
	   3=trace every node consideration
	*/

	/* Duplicating nodes */

	var tmpid_count=1;

	// This recreates a node and it's DOM context (containers) on
	//  a new page, calling itself recursively as needed
	function dupContext(node,page,dups){
	    if ((node===document.body)||(node.id==="CODEXCONTENT")||
		(node.id==="CODEXROOT")||(hasClass(node,"codexroot"))||
		(hasClass(node,"codexpage")))
		return false;
	    else if (hasParent(node,page)) return node;
	    else if ((node.className)&&
		     (node.className.search(/\bcodexwraptext\b/)>=0))
		// We don't bother duplicating text wrapping convenience
		//  classes
		return dupContext(node.parentNode,page,dups);
	    // Now we actually duplicate it.  
	    var id=node.id;
	    // If it doesn't have an ID, we give it one, because we'll want
	    //  to refer to it later while wanting to avoid DOM cycles
	    if (!(id)) id=node.id="CODEXTMPID"+(tmpid_count++);
	    else {
		// See if it's already been duplicated
		var dup=dups[id];
		if ((dup)&&(hasParent(dup,page))) return dup;}
	    // Duplicate it's parent
	    var copy=node.cloneNode(false);
	    var parent=dupContext(node.parentNode,page,dups);
	    var nodeclass=node.className||"";
	    // Jigger the class name
	    copy.className=
		((nodeclass.replace(/\b(codexrelocated|codexdup.*)\b/,""))+
		 " codexdup").replace(/\s+/," ").trim();
	    if (nodeclass.search(/\bcodexdupstart\b/)<0)
		node.className=nodeclass+" codexdupstart";
	    // If the original had an ID, save it in various ways
	    if (node.id) {
		copy.codexid=node.id;
		copy.setAttribute("data-baseid",node.id);
		copy.id=null;}
	    // Record the copy you've made (to avoid recreation)
	    dups[id]=copy;
	    // If it's got a copied context, append it to the context;
	    //   otherwise, just append it to the page
	    if (parent) parent.appendChild(copy);
	    else page.appendChild(copy);
	    return copy;}

	/* Moving nodes */

	var codex_reloc_serial=1;
	
	// This moves a node into another container, leaving
	// a back pointer for restoration
	function moveNode(arg,into,blockp){
	    var baseclass; var node=arg;
	    // If we're moving a first child, we might as well move the parent
	    if (hasParent(node,into)) return node;
	    while ((node.parentNode)&&(node===node.parentNode.firstChild)&&
		   (node.parentNode!==document.body)&&
		   (node.parentNode!==Codex.content)&&
		   (!(hasClass(node.parentNode,"codexpage"))))
		node=node.parentNode;
	    if (node.nodeType===1) baseclass=node.className;
	    else if (node.nodeType===3) {
		// Wrap text nodes in elements before moving
		var wrapnode=fdjtDOM(
		    ((blockp)?"div.codexwraptext":"span.codexwraptext"));
		node.parentNode.replaceChild(wrapnode,node);
		wrapnode.appendChild(node);
		baseclass="codexwraptext";
		node=wrapnode;}
	    if ((node.parentNode)&&(!(node.getAttribute("data-codexorigin")))) {
		// Record origin information; we'll use this to revert
		//  the layout if we need to (for example, before
		//  laying out again under different constraints)
		var origin=fdjtDOM("span.codexorigin");
		var id=origin.id="CODEXORIGIN"+(codex_reloc_serial++);
		if (baseclass) node.className=baseclass+" codexrelocated";
		else node.className="codexrelocated";
		node.setAttribute("data-codexorigin",id);
		node.parentNode.replaceChild(origin,node);}
	    into.appendChild(node);
	    return node;}
	
	// This moves a node onto a page, recreating its original DOM
	// context on the new page.
	function moveNodeToPage(node,page,dups){
	    if ((!(page.getAttribute("data-topid")))&&
		(node.id)&&(Codex.docinfo[node.id])) {
		var info=Codex.docinfo[node.id];
		page.setAttribute("data-topid",node.id);
		page.setAttribute("data-sbookloc",info.starts_at);}
	    if (hasParent(node,page)) return node;
	    var parent=node.parentNode;
	    if ((!(parent))||(parent===document.body)||
		(parent.id==="CODEXCONTENT")||(parent.id==="CODEXROOT")||
		(hasClass(parent,"codexroot"))||(hasClass(parent,"codexpage")))
		// You don't need to dup the parent on the new page
		return moveNode(node,page);
	    else {
		var dup_parent=dupContext(parent,page,dups);
		return moveNode(node,dup_parent||page);}}

	// Reverting layout

	function restoreNode(node,info){
	    var originid=node.getAttribute("data-codexorigin");
	    var origin=((originid)&&document.getElementById(originid));
	    if (origin) {
		if (hasClass(node,/\bcodexwraptext\b/g)) {
		    if (hasClass(node,/\bcodexwraptextsplit\b/g))
			origin.parentNode.replaceChild(
			    info.texts[originid],origin);
		    else origin.parentNode.replaceChild(
			node.childNodes[0],origin);}
		else origin.parentNode.replaceChild(node,origin);}
	    dropClass(node,"codexrelocated");
	    node.removeAttribute("data-codexorigin");}
	
	function revertLayout(layout) {
	    var tweaked=TOA(layout.container.getElementsByClassName("codextweaked"));
	    if ((tweaked)&&(tweaked.length)) {
		fdjtLog("Dropping tweaks of %d relocated nodes",tweaked.length);
		var i=0; var lim=tweaked.length;
		while (i<lim) {
		    var node=tweaked[i++]; node.style='';
		    dropClass(node,"codextweaked");
		    if ((node.tagName==='img')||(node.tagName==='IMG')) {
			node.width=''; node.height='';}}}
	    var cantsplit=TOA(layout.container.getElementsByClassName("codextweaked"));
	    dropClass(cantsplit,"codexcantsplit");
	    var moved=TOA(layout.container.getElementsByClassName("codexrelocated"));
	    if ((moved)&&(moved.length)) {
		fdjtLog("Restoring original layout of %d relocated nodes and %d texts",
			moved.length);
		var i=0; var lim=moved.length;
		while (i<lim) restoreNode(moved[i++],layout);}}
	
	function CodexLayout(init){
	    if (!(init)) init={};

	    var forcebreakbefore=this.forcebreakbefore=init.forcebreakbefore||false;
	    var forcebreakafter=this.forcebreakafter=init.forcebreakafter||false;
	    var avoidbreakinside=this.avoidbreakinside=init.avoidbreakinside||false;
	    var avoidbreakafter=this.avoidbreakafter=init.avoidbreakafter||false;
	    var avoidbreakbefore=this.avoidbreakbefore=init.avoidbreakbefore||false;
	    var pageblock=this.pageblock=init.pageblock||false;
	    var fullpages=this.fullpages=init.fullpages||false;
	    var floatpages=this.floatpages=init.floatpages||false;
	    var pageprefix=this.pageprefix=init.pageprefix||"CODEXPAGE";

	    var page_height=this.height=init.page_height||fdjtDOM.viewHeight();
	    var page_width=this.width=init.page_height||fdjtDOM.viewWidth();
	    
	    var container=this.container=init.container||fdjtDOM("div.codexpages");
	    // This is the node DOM container where we place new pages
	    
	    // STATE variables

	    var pagenum=this.pagenum=0; // Tracks current page number
	    var pages=this.pages=[]; // Array of all pages generated, in order
	    var dups=this.dups={}; // Tracks nodes/contexts already duplicated

	    var textsplits=this.textsplits={};
	    // Tracks text nodes which have been split, keyed by the
	    // temporary IDs assigned to them

	    var page=this.page=init.page; // Contains the currently open page

	    var prev=this.prev=[]; // The last terminal block we processed

	    var drag=this.drag=[];
	    // this.drag[] contains nodes which will go on the next
	    // page when we get there.  The nodes in this.drag[] have
	    // already been placed on pages, but we keep track of them
	    // in case we need to move them to a new page to honor
	    // nobreak constraints.

	    var float_pages=this.float_pages=[];
	    // this.float_pages contains fully-assembled page nodes to
	    // placed in pages after this one; it is intended for
	    // out-of-flow or 'too bit to fit' content

	    var float_blocks=this.float_blocks=[];
	    // this.float_blocks is an array of blocks to place into
	    // the flow there is a chance.  This is intended for use
	    // by figures/tables/etc which we don't want to embed

	    // Startup

	    this.started=false; // When we started
	    this.tracelevel=init.tracelevel||CodexLayout.tracelevel; // How much to trace
	    this.roots=init.roots||false; // Where all roots can be bracked
	    this.root_count=0; // Number of root nodes added
	    
	    this.pagerule=init.pagerule||false;
	    // This probably shouldn't go here
	    if (!(this.pagerule)) {
		var pagerule=fdjtDOM.addCSSRule(
		    "div.codexpage",
		    "width: "+page_width+"px; "+"height: "+page_height+"px;");
		this.pagerule=pagerule;}
	    
	    function addContent(root,trace) {

		if (!(page)) newPage();

		if (typeof trace === 'undefined') trace=this.tracelevel;
		if (!(this.started)) this.started=fdjtTime();
		this.root_count++;

		function loop(node){
		    var blocks=[], terminals=[];
		    // gather all of the block-level elements
		    // (recursively) in the node, noting which ones
		    // are terminals
		    gatherBlocks(node,blocks,terminals);
		    // Then move the node onto the current page; we
		    // set node, because it might be transformed in
		    // some way when moved (if, for example, it is a
		    // text node, it will be wrapped).
		    node=moveNodeToPage(node,page,dups);
		    // Iterate over all of the blocks
		    var i=0, n=blocks.length; while (i<n) {
			var block=blocks[i];
			var terminal=terminals[i]||false;
			// FIRST, HANDLE DRAGGING
			// If this block is terminal and we don't want
			//  to break before this block or after the
			//  preceding block, drag along the previous block.
			//  NOTE that dragged blocks have already been placed.
			if ((block)&&(terminal)&&(prev)&&
			    ((avoidBreakBefore(block))||
			     (avoidBreakAfter(prev))))
			    drag.push(prev);
			else if ((block)&&(terminal))
			    // Otherwise, we don't have to worry about
			    // what we're dragging along
			    this.drag=drag=[];
			else {}
			// If a block is false, continue
			if (!(block)) {i++; continue;}
			else if ((hasClass(block,/\bcodexfloatpage\b/))||
				 ((floatpages)&&(testNode(block.floatpages)))) {
			    // Float pages just get pushed (until newPage bfelow)
			    float_pages.push[block]; i++; continue;}
			else if ((hasClass(block,/\bcodexfullpage\b/))||
				 ((fullpages)&&(testNode(block.fullpages)))) {
			    // Full pages automatically get their own page
			    prev=false; this.drag=drag=[];
			    fullPage(block);
			    i++; continue;}
			else if ((page.childNodes.length)&&
				 (forcedBreakBefore(block))) {
			    // This is the easy case.  Note that we
			    // don't force a page break if the current
			    // page is empty.
			    prev=false; this.drag=drag=[];
		    	    newPage(block);}
			else moveNodeToPage(block,page,dups);
			// Finally, we check if everything fits We're
			// walking through the blocks[] but only
			// advance when an element fits or can't be
			// split or tweaked Note that we may process
			// an element [i] more than once if we split
			// the node and part of the split landed back in [i].
			var geom=getGeometry(block,page);
			if (trace>2) fdjtLog("Layout/loop %o %j",block,geom);
			if ((terminal)&&(geom.bottom>page_height)) {
			    // We're a terminal node and we extend
			    // below the bottom of the page
			    if (geom.top>page_height)
				// If our top is also over the bottom of the page,
				//  we just start a new page
				newPage(block);
			    else if (hasClass(block,"codexcantsplit")) {
				// If we can't split this block (this
				// class might be added by previous
				// processing), we try to tweak it
				// (which means using CSS magic for
				// scaling, etc).
				if (!((hasClass(block,"codextweaked"))||
				      (hasClass(block,"codexavoidtweak"))))
				    tweakBlock(block);
				i++;}
			    else {
				// Now we try to split the block, we
				// store the 'split block' back in the
				// blocks variable because we might
				// need to split it again.
				blocks[i]=splitBlock(block);
				// If the block couldn't be split, try to tweak it
				// Could this be removed entirely?
				if (hasClass(block,"codexcantsplit")) {
				    var geom=getGeometry(block,page);
				    if (geom.bottom>page_height) {
					// Still over the edge, so tweak it
					if (!(hasClass(block,"codexavoidtweak")))
					    tweakBlock(block);}
				    i++;}}}
			// We fit on the page, so we'll look at the next block.
			else i++;
			// Update the prev pointer for terminals
			if (terminal) {this.prev=prev=block;}}}

		// Gather all the block-level elements inside a node,
		// recording which ones are terminals (don't have any
		// blocks within them)
		function gatherBlocks(node,blocks,terminals){
		    if (node.nodeType!==1) return;
		    if (node.codexui) return;
		    var style=getStyle(node); var disp=style.display;
		    if ((style.position==='static')&&(disp!=='inline')) {
			var loc=blocks.length; blocks.push(node); 
			if (avoidBreakInside(node)) terminals[loc]=true;
			else if ((disp==='block')||(disp==='table')) {
			    var children=node.childNodes;
			    var total_blocks=blocks.length;
			    var i=0; var len=children.length;
			    while (i<len) {gatherBlocks(children[i++],blocks,terminals);}
			    if (blocks.length==total_blocks) terminals[loc]=true;}
			else terminals[loc]=true;}}

		// Whether we need to create a new page to have 'node'
		//  at the page top We don't need a new page if the
		//  current page has no content or no content up until
		//  the node in question
		function needNewPage(node){
		    if (!(page)) return true;
		    else if (!(node))
			return hasContent(page,true,true);
		    else if (!(hasParent(node,page)))
			return hasContent(page,true,true);
		    else if (page.firstChild===node)
			return false;
		    else if (hasContent(page,node,true))
			return true;
		    else return false;}

		// Cerate a new page
		function newPage(node){
		    // If node exists, it is the first element on the new page
		    if ((float_pages)&&(float_pages.length)) {
			// First add any floating pages that may have
			// accumulated
			var i=0; var lim=float_pages.length;
			while (i<lim) fullPage(float_pages[i++]);
			float_pages=[];}
		    var newpage="pagetop";
		    if (needNewPage(node)) {
			// If we really need to create a new page, do so
			if (page) dropClass(page,"curpage");
			this.page=page=fdjtDOM("div.codexpage.curpage");
			pagenum++; this.pagenum=pagenum;
			page.id=pageprefix+(pagenum);
			page.setAttribute("data-pagenum",pagenum);
			fdjtDOM(container,page);
			pages.push(page);
			newpage="newpage";}
		    
		    if (trace>1) {
			if (node) fdjtLog("Layout/%s %o at %o",newpage,page,node);
			else fdjtLog("Layout/%s %o",newpage,page);}
		    
		    // If there are things we are dragging along, move
		    // them to the new page
		    if ((drag)&&(drag.length)) {
			var i=0; var lim=drag.length;
			while (i<lim) moveNodeToPage(drag[i++],page,dups);
			this.drag=drag=[];}
		    // Finally, move the node to the page
		    if (node) moveNodeToPage(node,page,dups);

		    this.prev=prev=false;
		    return page;}

		// Could this just be the following?
		function fullPage(node){
		    newPage(node);
		    tweakBlock(node);
		    newPage();}

		function fullPage(node){
		    var newpage="fullpagetop";
		    if ((!(page))||
			((!(node))&&(!(hasContent(page,true,true))))||
			(((node)&&(hasParent(node,page)))?
			 (hasContent(page,node,true)):
			 (hasContent(page,true,true)))) {
			if (page) dropClass(page,"curpage");
			this.page=page=fdjtDOM("div.codexpage.curpage");
			pagenum++; this.pagenum=pagenum;
			page.id=pageprefix+(pagenum);
			page.setAttribute("data-pagenum",pagenum);
			fdjtDOM(container,page);
			pages.push(page);
			newpage="newpage";}
		    
		    if (trace>1) {
			if (node) fdjtLog("Layout/%s %o at %o",newpage,page,node);
			else fdjtLog("Layout/%s %o",newpage,page);}
		    
		    if (node) moveNodeToPage(node,page,dups);
		    
		    tweakBlock(node);

		    // Now we make a new page for whatever comes next
		    newPage();

		    this.prev=prev=false;
		    this.prevstyle=prevstyle=false;
		    return page;}

		// This gets a little complicated
		function splitBlock(node){
		    if (avoidBreakInside(node)) {
			// Simplest case, if we can't split, we just make a new page
			addClass(node,"codexcantsplit");
			newPage(node);
			return node;}
		    // Otherwise, we remove all of the node's children
		    // and then add them back bit by bit.
		    var children=TOA(node.childNodes);
		    var i=children.length-1;
		    while (i>=0) node.removeChild(children[i--]);
		    var geom=getGeometry(node);
		    if (geom.bottom>page_height) {
			// If the version without any children is
			// already over the edge, just start a new
			// page on the node (after restoring all the
			// children)
			i=0; var n=children.length;
			while (i<n) node.appendChild(children[i++]);
			addClass(node,"codexcantsplit");
			newPage(node);
			return node;}
		    var page_break=node; var i=0; var n=children.length;
		    // We add children back until we go over the edge,
		    //  at which point we'll create a new page.
		    //  page_break is where we need to break If
		    //  page_break is the same as the node we're
		    //  trying to split, it means that we can't split
		    //  this node.
		    while (i<n) {
			var child=children[i++]; var nodetype=child.nodeType;
			// Add the child back and get the geometry
			node.appendChild(child); geom=getGeometry(node);
			if (geom.bottom>page_height) { // Over the edge
			    if ((nodetype!==3)&&(!((hasContent(node,child,true)))))
				// If there's no content before the
				// child (and it's not a text node
				// that can be split), just quit,
				// leaving page_break as the node
				// we're trying to split itself.
				break;
			    else if ((nodetype!==3)&&(nodetype!==1)) {
				// This is probably an error, so stop trying
				break;}
			    // If it's either text or relocated text, try to break it
			    else if ((nodetype===1)&&
				     (!(hasClass(child,"codexwraptext"))))
				// If it's an element, just push it over; this
				// could be more clever for inline elements
				page_break=child;
			    else {
				// If it's text, split it into words,
				// then replace the child with
				// 'probenode's containing
				// progressively longer and longer
				// strings.  It would be nice to use
				// some kind of binary search here,
				// but we want to get the longest
				// possible run of words because we
				// want to avoid ragged lines
				var text=((nodetype===3)?(child.nodeValue):
					  (child.firstChild.nodeValue));
				var words=text.split(/\b/g);
				var probenode=child;
				// If there's only one word, no splitting today,
				//  just push the node itself onto the next page
				if (words.length<2) {page_break=child; break;}
				// Try to find where the page should
				// break by advancing via words and
				// replacing the content of the text
				// node.
				var w=0; var wlen=words.length; var wordstart;
				// We consider all the breaks that
				// don't start with non-word
				// characters (e.g. punctuation, etc).
				while (w<wlen) {
				    wordstart=w++;
				    while ((w<wlen)&&(words[w].search(/\w/)<0)) w++;
				    // The newprobe is a try at a break point of w
				    var newprobe=document.createTextNode(
					words.slice(0,w).join(""));
				    node.replaceChild(newprobe,probenode);
				    probenode=newprobe;
				    geom=getGeometry(node);
				    // If the probe node put us over, break;
				    if (geom.bottom>page_height) break;}
				// We're done searching for the word break
				if ((wordstart===0)||(wordstart===wlen)) {
				    // If we didn't find anything, put
				    // the child back and make it into
				    // the page break
				    node.replaceChild(child,probenode);
				    page_break=child;
				    break;}
				else { // Do the split
				    page_break=document.createTextNode(
					// This is the text pushed onto the new page
					words.slice(wordstart).join(""));
				    var keep=document.createTextNode(
					words.slice(0,wordstart).join(""));
				    // We replace the probe node with 'keep'
				    node.replaceChild(keep,probenode);
				    // And insert the page break after 'keep'
			    	    fdjtDOM.insertAfter(keep,page_break);
				    // Finally, we save texts which
				    // we've split for later restoration
				    if ((nodetype===1)&&
					(child.getAttribute("data-codexorigin"))) {
					var originid=child.getAttribute("data-codexorigin");
					textsplits[originid]=child.firstChild;}}}
			    break;}
			else continue;}
		    // Finally, we create a new page
		    newPage(page_break);
		    if (page_break===node) {
			// If we couldn't find an internal page_break, this node can't be split
			addClass(node,"codexcantsplit");
			if (trace) fdjtLog("Layout/cantBreak %o onto %o",node,page);}
		    else if (page_break!==node) {
			var dup=page_break.parentNode;
			// This (dup) is the copied parent of the page
			// break.  We append all the remaining children
			// to this duplicated parent on the new page.
			while (i<n) dup.appendChild(children[i++]);
			if (trace>1)
			    fdjtLog("Layout/splitBlock %o @ %o into %o on %o",
				    node,page_break,dup,page);}
		    else {}
		    return dup;}

		// This uses lots of tricks (mostly CSS3) to get a
		// page to fit after subdivision based layout which
		// hasn't yielded adequate results
		function tweakBlock(node,avail_width,avail_height){
		    if (hasClass(node,"codextweaked")) return;
		    else if (hasClass(node,"codexavoidtweak")) return;
		    else if (node.getAttribute("style")) {
			addClass(node,"codexavoidtweak");
			return;}
		    else addClass(node,"codextweaked");
		    var geom=getGeometry(node,page,true);
		    if (!((avail_width)&&(avail_height))) {
			var h_margin=(geom.left_margin+geom.right_margin);
			var v_margin=(geom.top_margin+geom.bottom_margin);
			if (!(avail_width))
			    avail_width=page_width-(geom.left_margin+geom.right_margin+geom.left);
			if (!(avail_height))
			    avail_height=page_height-(geom.top_margin+geom.bottom_margin+geom.top);}
		    // If the node doesn't have any dimensions,
		    //  something hasn't loaded, so don't try tweaking
		    if ((geom.width===0)||(geom.height===0)) return;
		    var scalex=(avail_width/geom.width);
		    var scaley=(avail_height/geom.height);
		    var scale=((scalex<scaley)?(scalex):(scaley));
		    // Try a CSS scale transform
		    node.style[fdjtDOM.transform]='scale('+scale+','+scale+')';
		    var ngeom=getGeometry(node,page,true);
		    if (ngeom.height===geom.height) {
			if ((node.tagName==='IMG')||(node.tagName==='img')) {
			    node.style[fdjtDOM.transform]='';
			    scaleImage(node,scale,geom);}
			else {
			    // If that didn't work, try some tricks
			    var images=fdjtDOM.getChildren(node,"IMG");
			    if ((images)&&(images.length)) {
				var j=0; var jlim=images.length;
				while (j<jlim) {
				    var img=images[j++];
				    if (hasClass(img,/\bcodextweaked\b/)) continue;
				    else if (hasClass(img,/\bcodexavoidtweak\b/))
					continue;
				    else if ((img.getAttribute('style'))||
					     (img.getAttribute('width'))||
					     (img.getAttribute('height'))) {
					addClass(img,'codexavoidtweak');
					continue;}
				    var igeom=getGeometry(img,page);
				    // If the node doesn't have any
				    //  dimensions, it hasn't been loaded,
				    //  so don't try tweaking the page
				    if ((igeom.width===0)||(igeom.height===0))
					return;
				    var relscale=Math.max(
					igeom.width/geom.width,
					igeom.height/geom.height);
				    scaleImage(img,scale*relscale,igeom);}}}
			ngeom=getGeometry(node,page,true);
			if (ngeom.height===geom.height)
			    addClass(node,"codexuntweakable");}
		    addClass(node,"codextweaked");}

		
		loop(root);
		
		return this;}
	    this.addContent=addContent;

	    /* Finishing the page */

	    function finishPage(completed) {
		var page_width=this.width; var page_height=this.height;
		var bounds=insideBounds(completed);
		if (!((page_width)&&(page_height))) {
		    var geom=getGeometry(completed);
		    if (!(page_width)) page_width=geom.width;
		    if (!(page_height)) page_height=geom.height;}
		if ((bounds.width>page_width)||(bounds.height>page_height)) {
		    var scaled=fdjt$(".codexscale",completed);
		    if ((scaled)&&(scaled.length)) {
			// To be implemented: try adjusting these elements first
			bounds=insideBounds(completed);}
		    if ((bounds.width>page_width)||(bounds.height>page_height)) {
			var boxed=fdjtDOM("div",completed.childNodes);
			var scalex=page_width/bounds.width;
			var scaley=page_height/bounds.height;
			var scale=((scalex<scaley)?(scalex):(scaley));
			var transform='scale('+scale+','+scale+')';
			boxed.style[fdjtDOM.transform]=transform;
			boxed.style[fdjtDOM.transform+"-origin"]='top';
			completed.appendChild(boxed);}}
		dropClass(completed,"curpage");}
	    this.finishPage=finishPage;

	    /* Finishing the overall layout */

	    function Finish(){
		for (dupid in dups) {
		    var dup=dups[dupid];
		    dup.className=dup.className.replace(
			    /\bcodexdup\b/,"codexdupend");}
		dropClass(page,"curpage");
		var i=0; var lim= pages.length;
		while (i<lim) finishPage(pages[i++]);
		this.done=fdjtTime();}
	    this.Finish=Finish;

	    /* page break predicates */
	    
	    function forcedBreakBefore(elt,style){
		if (!(elt)) return false;
		if (!(style)) style=getStyle(elt);
		return (style.pageBreakBefore==='always')||
		    (hasClass(elt,"forcebreakbefore"))||
		    ((forcebreakbefore)&&(testNode(elt,forcebreakbefore)));}
	    this.forcedBreakBefore=forcedBreakBefore;
	    
	    function forcedBreakAfter(elt,style){ 
		if (!(elt)) return false;
		if (!(style)) style=getStyle(elt);
		return (style.pageBreakAfter==='always')||
		    (hasClass(elt,"forcebreakafter"))||
		    ((forcebreakafter)&&(testNode(elt,forcebreakafter)));}
	    this.forcedBreakAfter=forcedBreakAfter;

	    // We explicitly check for these classes because some browsers
	    //  which should know better (we're looking at you, Firefox) don't
	    //  represent (or handle) page-break 'avoid' values.  Sigh.
	    var page_block_classes=/\b(avoidbreakinside)|(sbookpage)\b/;
	    function avoidBreakInside(elt,style){
		if (!(elt)) return false;
		if (elt.tagName==='IMG') return true;
		if (!(style)) style=getStyle(elt);
		return (style.pageBreakInside==='avoid')||
		    ((elt.className)&&(elt.className.search(page_block_classes)>=0))||
		    ((avoidbreakinside)&&(testNode(elt,avoidbreakinside)));}
	    this.avoidBreakInside=avoidBreakInside;
	    
	    function avoidBreakBefore(elt,style){
		if (!(elt)) return false;
		if (!(style)) style=getStyle(elt);
		var info=((elt.id)&&(Codex.docinfo[elt.id]));
		return ((style.pageBreakBefore==='avoid')||
			(hasClass(elt,"abovebreakbefore"))||
			((avoidbreakbefore)&&(testNode(elt,avoidbreakbefore))));}
	    this.avoidBreakBefore=avoidBreakBefore;

	    function avoidBreakAfter(elt,style){
		if (!(elt)) return false;
		if (!(style)) style=getStyle(elt);
		if (style.pageBreakAfter==='avoid') return true;
		else if ((style.pageBreakAfter)&&(style.pageBreakAfter!=="auto"))
		    return false;
		else return ((avoidbreakafter)&&(testNode(elt,avoidbreakafter)));}
	    this.avoidBreakAfter=avoidBreakAfter;
	    
	    function getPage(spec) {
		if (!(spec)) return false;
		else if (typeof spec === 'number')
		    return fdjtID(pageprefix+spec);
		else if (spec.nodeType) {
		    if (hasClass(spec,"codexpage")) return spec;
		    else return getParent(spec,".codexpage");}
		else if (typeof spec === "string")
		    return getPage(fdjtID(spec));
		else {
		    fdjtLog("Can't determine page from %o",spec);
		    return false;}}
	    this.getPage=getPage;

	    /* Finally return the layout */

	    return this;}

	CodexLayout.tracelevel=0;
	
	return CodexLayout;})();

var CodexPagiante=
    (function(){

	var getGeometry=fdjtDOM.getGeometry;
	var hasClass=fdjtDOM.hasClass;
	var addClass=fdjtDOM.addClass;
	var dropClass=fdjtDOM.dropClass;
	var TOA=fdjtDOM.toArray;
	
	function Paginate(why,init){
	    if (Codex.paginating) return;
	    if (!(why)) why="because";
	    var height=getGeometry(fdjtID("CODEXPAGE")).height;
	    var width=getGeometry(fdjtID("CODEXPAGE")).width;
	    var bodysize=Codex.bodysize||"normal";
	    var bodyfamily=Codex.bodyfamily||"serif";
	    if (Codex.paginated) {
		var current=Codex.paginated;
		if ((!(init.forced))&&
		    (width===current.page_width)&&
		    (height===current.page_height)&&
		    (bodysize===current.bodysize)&&
		    (bodyfamily===current.bodyfamily)) {
		    fdjtLog("Skipping redundant pagination %j",current);
		    return;}
		Codex.paginated.revert();
		Codex.paginated=false;}
	    // Create a new layout
	    var layout=new CodexLayout(getLayoutArgs());
	    Codex.paginating=layout;
	    layout.bodysize=bodysize; layout.bodyfamily=bodyfamily;
	    dropClass(document.body,"codexscrollview");
	    addClass(document.body,"codexpageview");
	    fdjtID("CODEXPAGE").style.visibility='hidden';
	    // Now walk the content
	    var content=Codex.content;
	    var nodes=TOA(content.childNodes);
	    fdjtLog("Laying out %d root nodes into %dx%d pages (%s)",
		    nodes.length,layout.page_width,layout.page_height,
		    (why||""));
	    var coverpage=fdjtID("CODEXCOVERPAGE")||
		fdjtID("SBOOKCOVERPAGE")||
		fdjtID("COVERPAGE");
	    if (coverpage) layout.addContent(coverpage);
	    else {
		var coverimage=fdjtDOM.getLink("sbook.coverpage",false,false)||
		    fdjtDOM.getLink("coverpage",false,false);
		if (coverimage) {
		    var img=fdjtDOM.Image(
			coverimage,"img.codexcoverpage.sbookpage");
		    fdjtDOM.prepend(Codex.content,img);
		    layout.addContent(img);}}
	    fdjtTime.slowmap(function(node){
		if ((node.nodeType===1)||(node.nodeType===3)) layout.addContent(node);},
			     nodes,
			     function(state,i,lim,chunks,used,zerostart){
				 if (state==='suspend') progress(layout,used,chunks);
				 else if (state==='done')
				     fdjtLog("Layout/%d HTML blocks across %d pages after %dms, taking %fms over %d chunks",
					     lim,layout.pagenum,fdjtTime()-zerostart,
					     used,chunks);},
			     function(){
				 layout.Finish();
				 progress(layout);
				 fdjtID("CODEXPAGE").style.visibility='visible';
				 Codex.paginated=layout;
				 Codex.pagecount=layout.pages.length;
				 if (Codex.pagewait) {
				     var fn=Codex.pagewait;
				     Codex.pagewait=false;
				     fn();}
				 Codex.GoTo(
				     Codex.location||Codex.target||
					 fdjtID("SBOOKSTARTPAGE")||fdjtID("SBOOKCOVERPAGE")||
					 fdjtID("SBOOKTITLEPAGE")||fdjtID("COVERPAGE")||
					 fdjtID("TITLEPAGE")||fdjtID("CODEXPAGE1"));
				 Codex.paginating=false;},
			     200,50);}
	Codex.Paginate=Paginate;

	/* Reporting progress, debugging */
	
	function progress(info,used,chunks){
	    var started=info.started;
	    var pagenum=info.pagenum;
	    var now=fdjtTime();
	    if (!(pagenum)) return;
	    if (!(Codex._setup)) {
		if (info.done) Codex.startupMessage("Finished page layout");
		else if (info.pagenum)
		    Codex.startupMessage("Laid out %d pages so far",info.pagenum);
		else Codex.startupMessage("Preparing for page layout");}
	    if (info.done)
		if (used)
		    fdjtLog("Done with %d pages after %f seconds (%f running across %d chunks)",
			    pagenum,fdjtTime.secs2short((now-started)/1000),
			    fdjtTime.secs2short(used/1000),chunks)
	    else fdjtLog("Done with %d pages after %f seconds",
			 pagenum,fdjtTime.secs2short((now-started)/1000));
	    else if (typeof pagenum === 'number') {
		fdjtDOM.replace(
		    "CODEXPAGEPROGRESS",
		    fdjtDOM("span#CODEXPAGEPROGRESS",pagenum));
		if (Codex.Trace.layout) {
		    if (used)
			fdjtLog("So far, laid out %d pages in %f seconds (%f running across %d chunks)",
				pagenum,fdjtTime.secs2short((now-started)/1000),
				fdjtTime.secs2short(used/1000),chunks);
		    else fdjtLog("So far, laid out %d pages in %f seconds (%f running across %d chunks)",
				 pagenum,fdjtTime.secs2short((now-started)/1000));}}
	    else {}}
	
	CodexLayout.onresize=function(evt){
	    Codex.Paginate("resize");};
	
	Codex.addConfig(
	    "pageview",
	    function(name,val){
		if (val) {
		    if (!(Codex.docinfo)) {
			// If there isn't any docinfo (during startup, for
			// instance), don't bother actually paginating.
			Codex.paginate=true;}
		    else if (!(Codex.paginate)) {
			Codex.paginate=true;
			if (Codex.postconfig)
			    Codex.postconfig.push(Paginate);
			else Codex.Paginate("config");}}
		else {
		    clearPagination();
		    Codex.paginate=false;
		    dropClass(document.body,"codexpageview");
		    addClass(document.body,"codexscrollview");}});

	function updateLayout(name,val){
	    fdjtDOM.swapClass(
		Codex.page,new RegExp("codex"+name+"\w*"),"codex"+name+val);
	    Codex[name]=val;
	    if (Codex.paginated) {
		if (Codex.postconfig) {
		    Codex.postconfig.push(function(){
			CodexMode(true);
			Codex.Paginate(name);});}
		else {
		    CodexMode(true);
		    Codex.Paginate(name);}}}
	Codex.addConfig("bodysize",updateLayout);
	Codex.addConfig("bodyfamily",updateLayout);
	
	function getLayoutArgs(){
	    var height=getGeometry(fdjtID("CODEXPAGE")).height;
	    var width=getGeometry(fdjtID("CODEXPAGE")).width;
	    var container=fdjtDOM("div.codexpages#CODEXPAGES");
	    var args={page_height: height,page_width: width,container: container};
	    fdjtDOM.replace("CODEXPAGES",container);
	    
	    var avoidpagebreak=fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakinside",true));
	    if (avoidpagebreak) args.avoidpagebreak=avoidpagebreak;
	    var forcebreakbefore=fdjtDOM.sel(fdjtDOM.getMeta("forcebreakbefore",true));
	    if (forcebreakbefore) args.forcebreakbefore=forcebreakbefore;
	    var forcebreakafter=fdjtDOM.sel(fdjtDOM.getMeta("forcebreakafter",true));
	    if (forcebreakafter) args.forcebreakafter=forcebreakafter;
	    var avoidpagefoot=fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakafter",true));
	    if (avoidpagefoot) args.avoidpagefoot=avoidpagefoot;
	    var avoidpagehead=fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakbefore",true));
	    if (avoidpagehead) args.avoidpagehead=avoidpagehead;
	    var fullpages=fdjtDOM.sel(fdjtDOM.getMeta("sbookfullpage",true));
	    if (fullpages) args.fullpages=fullpages;
	    var floatpages=fdjtDOM.sel(fdjtDOM.getMeta("sbookfloatpage",true));
	    if (floatpages) args.floatpages=floatpages;

	    return args;}
	CodexLayout.getLayoutArgs=getLayoutArgs;

	/* Updating the page display */

	function updatePageDisplay(pagenum,location) {
	    var npages=Codex.pagecount;
	    var pbar=fdjtDOM("div.progressbar#CODEXPROGRESSBAR");
	    var book_len=Codex.ends_at;
	    pbar.style.left=(100*((pagenum-1)/npages))+"%";
	    pbar.style.width=(100/npages)+"%";
	    var locoff=
		((typeof location==='number')?
		 (fdjtDOM(
		     "span.locoff#CODEXLOCOFF","L"+Math.floor(location/128))):
		 (fdjtDOM("span.locoff#CODEXLOCOFF")));
	    var pageno_text=fdjtDOM(
		"span#CODEXPAGENOTEXT.pageno",pagenum,"/",npages);
	    var pageno=fdjtDOM("div#CODEXPAGENO",locoff,pageno_text);
	    fdjtDOM.replace("CODEXPAGENO",pageno);
	    fdjtDOM.replace("CODEXPROGRESSBAR",pbar);
	    locoff.title="click to jump to a particular location";
	    fdjtDOM.addListeners(
		locoff,Codex.UI.handlers[Codex.ui]["#CODEXLOCOFF"]);
	    pageno_text.title="click to jump to a particular page";
	    fdjtDOM.addListeners(
		pageno_text,Codex.UI.handlers[Codex.ui]["#CODEXPAGENOTEXT"]);}

	
	/* Movement by pages */
	
	function getCSSLeft(node,wrapper){
	    var scan=node;
	    var indent=parsePX(getStyle(scan).marginLeft)||0;
	    while ((scan=scan.parentNode)&&(scan!==wrapper)) {
		var style=getStyle(scan);
		indent=indent+parsePX(style.paddingLeft,0)+
		    parsePX(style.borderLeft)+
		    parsePX(style.marginLeft);}
	    if (scan===wrapper) {
		var style=getStyle(scan);
		indent=indent+parsePX(style.paddingLeft,0)+
		    parsePX(style.borderLeft,0);}
	    return indent;}

	var curpage=false;
	
	function GoToPage(spec,caller){
	    var page=Codex.paginated.getPage(spec)||Codex.paginated.getPage(1);
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
	    curpage=page; Codex.curpage=pagenum;}
	Codex.GoToPage=GoToPage;
	
	function getPage(arg){
	    var page=Codex.paginated.getPage(arg)||Codex.paginated.getPage(1);
	    return parseInt(page.getAttribute("data-pagenum"));}
	Codex.getPage=getPage;
	
	function getPageAt(loc){
	    var elt=Codex.resolveLocation(loc);
	    return getPageElt(elt)||fdjtID("CODEXPAGE1");}
	Codex.getPageAt=getPageAt;
	
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
