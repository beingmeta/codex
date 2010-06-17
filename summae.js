/* -*- Mode: Javascript; -*- */

var sbooks_summae_id="$Id$";
var sbooks_summae_version=parseInt("$Revision$".slice(10,-1));

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
var sbook_delete_icon="redx16x16.png";



(function () {

    function _sbook_sort_summaries(x,y){
	var xid=((x.id)||(x.fragid)||false);
	var yid=((y.id)||(y.fragid)||false);
	if ((xid)&&(yid))
	    if (xid===yid)
		if ((x.tstamp)&&(y.tstamp))
		    return (y.tstamp<x.tstamp)-(x.tstamp<y.tstamp);
	else if (x.tstamp) return -1;
	else if (y.tstamp) return 1;
	else return 0;
	else {
	    var xelt=document.getElementById(xid);
	    var xloc=((xelt)&&(xelt.sbookloc));
	    var yelt=document.getElementById(yid);
	    var yloc=((yelt)&&(yelt.sbookloc));
	    if ((xloc)&&(yloc))
		if (xloc<yloc) return -1; else return 1;
	    else if (xloc) return -1;
	    else return -1;}
	else if (xid) return -1;
	else if (yid) return 1;
	else return 0;
    }
    function sourceIcon(info){
	var pic=_sbookSourceImage(info);
	if (pic) return fdjtDOM.Image(pic,".feedpic",info.name);
	else return false;}

    function sbicon(name,suffix) {return sbook.graphics+name+(suffix||"");}

    function sourceImage(info){
	if (info.pic) return info.pic;
	var kind=info.kind;
	if (kind===':PERSON')
	    return sbicon("sbooksperson40x40.png");
	else if (kind===':CIRCLE')
	    return sbicon("sbookscircle40x40.png");
	else if (kind===':OVERDOC')
	    return sbicon("sbooksoverdoc40x40.png");
	else return false;}

    function sumText(target){
	var title=(sbook.getTitle(target)||fdjtDOM.textify(target)).
	    replace(/\n\n+/g,"\n");
	if (title.length<40) return title;
	else return title.slice(0,40)+"\u22ef ";}

    function makeTOCBlock(target,head,eltspec,extra){
	if (!(head)) head=sbook.getHead(target);
	var basespan=fdjtDOM("span");
	var title=(sbook.getTitle(target)||fdjtDOM.textify(target)).
	    replace(/\n\n+/g,"\n");
	if (target!==head) {
	    var paratext=fdjtDOM("span.paratext",
				 fdjtDOM("span.spacer","\u00B6"),
				 sumText(target));
	    fdjtDOM(basespan,paratext," ");}
	if (head) {
	    var headtext=fdjtDOM("span.headtext",
				 fdjtDOM("span.spacer","\u00A7"),
				 sumText(head));
	    fdjtDOM(basespan,headtext," ");
	    var heads=sbook.Info(head).heads;
	    if (heads) {
		var curspan=basespan;
		var j=heads.length-1; while (j>=0) {
		    var hinfo=heads[j--]; var elt=fdjtID(hinfo.frag);
		    if ((!(elt))||(!(hinfo.title))||
			(elt===sbook.root)||(elt===document.body))
			continue;
		    var newspan=
			fdjtDOM("span.head",
				fdjtDOM("span.headtext",
					fdjtDOM("span.spacer","\u00A7"),
					hinfo.title));
		    if (target===head) fdjtDOM(curspan,newspan);
		    else fdjtDOM(curspan," \u22ef ",newspan);
		    curspan=newspan;}}}
	var tocblock=((eltspec)?(fdjtDOM(eltspec,basespan)):
		      (fdjtDOM("div.tochead",basespan)));
	tocblock.title=title;
	tocblock.sbook_ref=target.id;
	return tocblock;}

    function getTarget(arg){
	if (arg)
	    if (typeof arg === 'string')
		return document.getElementById(arg);
	else if (arg.nodeType) return arg;
	else if (arg.frag)
	    return document.getElementById(arg.frag);
	else if (arg.id) return sbook.docinfo[arg.id];
	else return false;
	else return false;}
    
    function showSummaries(summaries,summary_div,query){
	var todisplay=[].concat(summaries).sort(_sbook_sort_summaries);
	var curtarget=false; var curblock=false;
	var i=0; var len=todisplay.length; while (i<len) {
	    var summary=todisplay[i++];
	    var info=sbook.Info(summary);
	    var target=getTarget(summary);
	    var tinfo=sbook.docinfo[target.id];
	    if (target!==curtarget) {
		var head=sbook.getHead(target);
		var blockhead=makeTOCBlock(target,head);
		var block=fdjtDOM("div.tocblock",blockhead);
		block.blockloc=tinfo.sbookloc;
		block.sbook_ref=block.blockid=target.id;
		fdjtDOM(summary_div,block);
		curblock=block; curtarget=target;}
	    fdjtDOM(curblock,summaryDiv(info,query));}
	return summary_div;
    }
    sbookUI.showSummaries=showSummaries;

    function addSummary(summary,summary_div,query){
	var curtarget=false; var curblock=false;
	var target_id=((summary.id)||(summary.fragid)||false);
	var target=((target_id)&&(fdjtID(target_id)));
	var info=sbook.docinfo[target_id];
	if (!target) return;
	var targetloc=info.sbookloc;
	var head=sbook.getHead(target);
	var children=summary_div.childNodes; var placed=false;
	var sum_div=summaryDiv(summary,query);
	var i=0; while (i<children.length) {
	    var child=children[i++];
	    if (child.nodeType!==1) continue;
	    if (!(child.blockloc)) continue;
	    if (child.blockid===target_id) {
		fdjtDOM(child,sum_div);
		placed=true;
		break;}
	    else if (child.blockloc>targetloc) {
		var blockhead=makeTOCBlock(target,head);
		var block=fdjtDOM("div.tocblock",blockhead,sum_div);
		block.blockloc=targetloc;
		block.sbook_ref=block.blockid=target.id;
		fdjtDOM.insertBefore(child,block);
		placed=true;
		break;}}
	if (!(placed)) {
	    var blockhead=makeTOCBlock(target,head);
	    var block=fdjtDOM("div.tocblock",blockhead,sum_div);
	    block.blockloc=targetloc;
	    block.sbook_ref=block.blockid=target.id;
	    fdjtDOM(summary_div,block);}
	return;}
    sbookUI.addSummary=addSummary;

    /* Showing a single summary */

    function summaryDiv(info,query){
	var key=info.qid||info.oid||info.id;
	var target_id=(info.frag)||(info.id);
	var target=((target_id)&&(fdjtID(target_id)));
	var refiners=((query) && (query._refiners));
	var sumdiv=fdjtDOM(((info.gloss) ? "div.summary.gloss" : "div.summary"));
	if (target_id) sumdiv.sbook_ref=target_id;
	if (info.qid) sumdiv.sbook_qid=info.qid;
	else if (info.oid) sumdiv.sbook_qid=info.oid;
	var infospan=fdjtDOM("span.info");
	if ((query) && (query[key])) { /* If you have a score, use it */
	    var scorespan=fdjtDOM("span.score");
	    var score=query[key]; var k=0;
	    while (k<score) {fdjtDOM(scorespan,"*"); k++;}
	    fdjtDOM(infospan,scorespan);}
	fdjtDOM(sumdiv,infospan);
	var tags=info.tags||[];
	if (!(tags instanceof Array)) tags=[tags];
	if (refiners)
	    tags.sort(function(t1,t2) {
		var s1=refiners[t1]; var s2=refiners[t2];
		if ((s1) && (s2))
		    if (s1>s2) return -1;
		else if (s1===s2) return 0;
		else return -1;
		else if (s1) return -1;
		else if (s2) return 1;
		else return 0;});
	var head=((info.level) ? (target) :
		  ((sbook.getHead(target))||(target)));
	if (head===document.body) head=target;
	if (info.gloss) sbookMarkInfo(sumdiv,info);
	if (info.gloss)
	    fdjtDOM(sumdiv,
		    (sbookDetailsButton(info)),(sbookXRefsButton(info)),
		    ((info.note)&&(fdjtDOM("span.note",info.note))),((info.note)&&" "),
		    ((info.excerpt)&&(sbookExcerptSpan(info.excerpt))));
	else {
	    var contentspan=fdjtDOM("span.content");
	    fdjtDOM(sumdiv,contentspan);}
	var tagspan=sumdiv;
	if ((tags)&&(tags.length>0)) fdjtDOM(sumdiv," // ");
	var j=0; var first=true; while (j<tags.length) {
	    var tag=tags[j++];
	    if (j===1) fdjtDOM(tagspan,Knodule.HTML(tag));
	    else if ((j===7) &&
		     (tagspan===sumdiv) &&
		     (tags.length>10)) {
		var controller=fdjtDOM("span.controller",
				       "\u00b7\u00b7\u00b7",tags.length-6,
				       "+\u00b7\u00b7\u00b7");
		tagspan=fdjtDOM("span.moretags.fdjtexpands.closed");
		controller.title=("click to toggle more tags");
		controller.onclick=fdjtUI.Expansion.onclick;
		fdjtDOM(sumdiv," ",controller," ",tagspan);
		fdjtDOM(tagspan,Knodule.HTML(tag));}
	    else fdjtDOM(tagspan," \u00b7 ",Knodule.HTML(tag));}
	if (info.detail) 
	    fdjtDOM(sumdiv,fdjtDOM("div.detail",info.detail));
	if (info.xrefs)  {
	    var xrefs=info.xrefs;
	    var xrefspan=fdjtDOM("span.xrefs");
	    for (var uri in xrefs) {
		var title=xrefs[uri];
		var spec=((uri===title)?("a.xref.raw"):("a.xref"));
		var icon=fdjtDOM.Image(sbicon("outlink16x8.png"));
		var xref=fdjtDOM.Anchor(uri,spec,icon,title);
		xref.target='_blank';
		fdjtDOM(xrefspan,xref,"\n");}
	    fdjtDOM(sumdiv,xrefsdiv);}
	if (info.attachments)  {
	    var attachments=info.attachments;
	    var attachmentspan=fdjtDOM("span.attachments");
	    for (var uri in attachments) {
		var title=attachments[uri];
		var spec=((uri===title)?("a.attachment.raw"):("a.attachment"));
		var icon=fdjtDOM.Image(sbicon("outlink16x8.png"));
		var attachment=fdjtDOM.Anchor(uri,spec,icon,title);
		attachment.target='_blank';
		fdjtDOM(attachmentspan,attachment,"\n");}
	    fdjtDOM(sumdiv,attachmentsdiv);}
	return sumdiv;}
    sbookUI.summaryDiv=summaryDiv;

    function sbookMarkInfo(sumdiv,info){
	var user=info.user;
	var feed=info.feed||false;
	var userinfo=sbook.sourcekb.map[user];
	var feedinfo=sbook.sourcekb.map[feed];
	var img=((info.pic)&&(fdjtDOM.Image((info.pic),"glosspic",userinfo.name)))||
	    ((userinfo.pic)&&(fdjtDOM.Image((userinfo.pic),"userpic",userinfo.name)))||
	    (sbookSourceIcon(feedinfo))||(sbookSourceIcon(userinfo));
	var interval=((info.tstamp) ? (fdjtTime.tick()-info.tstamp) : (-1));
	var delete_button=
	    ((user===sbook.user)&&
	     (fdjtDOM.Anchor("https://"+sbook.server+"/v3/delete?GLOSS="+info.oid,
			     "A.deletebutton",
			     fdjtDOM.Image(sbicon(sbook_delete_icon),false,"x"))));
	var agespan=
	    ((interval>0)&&
	     ((interval>(5*24*3600)) 
	      ? (fdjtDOM.Anchor("https://"+sbook.server+"/v3/browse/"+info.gloss,
				"A.age",fdjtTime.tick2date(info.tstamp)))
	      : (fdjtDOM.Anchor("https://"+sbook.server+"/v3/browse/"+info.gloss,
				"A.age",fdjtTime.secs2string(info.tstamp)+
				" ago"))));
	if (agespan) {
	    agespan.onclick=fdjtUI.cancel;
	    agespan.target="sbookglosses";
	    agespan.title="browse this note/gloss";}
	if (delete_button) {
	    delete_button.onclick=fdjtUI.cancel;
	    delete_button.target="_blank";
	    delete_button.title="delete this note/gloss";}
	var relay_button;
	if (user===sbook.user) 
	    relay_button=
	    fdjtDOM.Image(sbicon(sbook_small_remark_icon),"remarkbutton","mark",
			  _("click to edit your comment"));
	else relay_button=
	    fdjtDOM.Image(sbicon(sbook_small_remark_icon),"remarkbutton","mark",
			  _("click to relay or respond"));
	relay_button.onclick=sbookRelay_onclick;
	fdjtDOM(sumdiv,img,
		fdjtDOM("span.glossinfo",agespan," ",relay_button," ",delete_button));}

    function sbookExcerptSpan(excerpt){
	var content=fdjtDOM("span.content",excerpt);
	var ellipsis=fdjtDOM("span.ellipsis","...");
	var container=fdjtDOM("span.excerpt","\u201c",content,ellipsis,"\u201d");
	container.onclick=function(evt) {
	    var parent=fdjtDOM.getParent(fdjtDOM.T(evt),".summary");
	    if (parent) {
		fdjtDOM.toggleClass(parent,"showexcerpt");
		evt.preventDefault(); evt.cancelBubble=true;}};
	return container;}

    function sbookDetailsButton(info){
	if (info.detail) {
	    var img=fdjtDOM.Image(sbicon(sbook_details_icon),"detailsbutton","details");
	    img.title="(show/hide) "+info.detail.replace(/\n\n+/g,'\n');
	    img.onclick=function(evt) {
		var anchor=fdjtDOM.getParent(fdjtDOM.T(evt),".summary");
		if (anchor) fdjtDOM.toggleClass(anchor,"showdetail");
		fdjtDOM.T(evt).blur(); if (anchor) anchor.blur();
		evt.preventDefault(); evt.cancelBubble=true;
		return false;};
	    return img;}
	else return false;}

    function sbookXRefsButton(info){
	if ((info.xrefs)&&(info.xrefs.length>0))
	    if (info.xrefs.length===1) {
		var img=fdjtDOM.Image(sbicon(sbook_outlink_icon),"xrefsbutton","xrefs");
		var anchor=fdjtDOM.Anchor(info.xrefs[0],"A",img);
		anchor.title='click to follow'; anchor.target='_blank';
		return anchor;}
	else {
	    var img=fdjtDOM.Image(sbicon(sbook_outlink_icon),"xrefsbutton","xrefs");
	    img.onclick=function(evt) {
		var anchor=fdjtDOM.getParent(fdjtDOM.T(evt),".summary");
		if (anchor) fdjtDOM.toggleClass(anchor,"showxrefs");
		fdjtDOM.T(evt).blur(); if (anchor) anchor.blur();
		evt.preventDefault(); evt.cancelBubble=true;
		return false;};
	    img.title=_("show/hide web references");
	    return img;}
	else return false;}

    function sbookRelay_onclick(evt){
	var target=fdjtUI.T(evt);
	while (target)
	    if (target.sbook_ref) break;
	else target=target.parentNode;
	if (!(target)) return;
	if (target.sbook_qid)
	    sbookMark(fdjtID(target.sbook_ref),sbook.sourcekb.map[target.sbook_qid]||false);
	else sbookMark(fdjtID(target.sbook_ref),false);
	evt.preventDefault(); evt.cancelBubble=true;}

    /* Selecting a subset of glosses to display */

    function selectSources(results_div,sources){
	if (!(sources)) {
	    fdjtDOM.dropClass(results_div,"sourced");
	    fdjtDOM.dropClass(fdjtDOM.$(".sourced",results_div),"sourced");
	    return;}
	fdjtDOM.addClass(results_div,"sourced");
	var blocks=fdjtDOM.$(".tocblock",results_div);
	var i=0; while (i<blocks.length) {
	    var block=blocks[i++];  var empty=true;
	    var summaries=fdjtDOM.$(".summary",block);
	    var j=0; while (j<summaries.length) {
		var summary=summaries[j++];
		var gloss=(summary.sbook_qid)&&sbook.glosses.map[summary.sbook_qid];
		if ((fdjtKB.contains(sources,gloss.user))||
		    (fdjtKB.contains(sources,gloss.feed))) {
		    fdjtDOM.addClass(summary,"sourced");
		    empty=false;}
		else fdjtDOM.dropClass(summary,"sourced");}
	    if (empty) fdjtDOM.dropClass(block,"sourced");
	    else fdjtDOM.addClass(block,"sourced");}
	if (sbook.target) sbookUI.scrollGlosses(results_div,sbook.target);}
    sbookUI.selectSources=selectSources;

    /* Results handlers */

    function setupSummaryDiv(div){
	div.title="(hold to glimpse,click to go) "+(div.title||"");
	if (sbook.interaction==="mouse") {
	    fdjtDOM.addListener(div,"click",summary_onclick);
	    fdjtDOM.addListener(div,"mousedown",sbookTOC.onmousedown);
	    fdjtDOM.addListener(div,"mouseup",sbookTOC.onmouseup);}
	else fdjtDOM.addListener(div,"click",sbookTOC.oneclick);}
    sbookUI.setupSummaryDiv=setupSummaryDiv;

    function summary_onclick(evt){
	evt=evt||event;
	if (!(evt)) return;
	var target=fdjtDOM.T(evt);
	if (fdjtDOM.isClickable(target)) return;
	var ref=sbook.getRef(target);
	if (ref) {
	    fdjtDOM.cancel(evt);
	    sbook.GoTo(ref);}}
    sbookUI.handlers.summary_onclick=summary_onclick;
    
})();
/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
