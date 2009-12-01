/* -*- Mode: Javascript; -*- */

var sbooks_searchui_id="$Id$";
var sbooks_searchui_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009 beingmeta, inc.
   This file implements the search component of a 
    Javascript/DHTML UI for reading large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knowlets, visit www.knowlets.net
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

function sbookShowSearch(result)
{
  if (!(result)) result=sbook_query;
  var results_div=fdjtDiv(".sbooksummaries.hud");
  results_div.onclick=sbookSummary_onclick;
  results_div.onmouseover=sbookSummary_onmouseover;
  sbookShowSearchSummaries(result,results_div);
  fdjtReplace("SBOOKSUMMARIES",results_div);
}

function sbookShowSearchSummaries(result,results_div)
{
  var results=result._results; var head_div;
  var refiners=result._refiners;
  if (results.length===0) 
    head_div=fdjtDiv("sorry");
  else head_div=fdjtDiv("count");
  var query=result._query;
  var j=0; while (j<query.length) 
	     fdjtAppend(head_div,((j>0)&&(" \u00b7 ")),
			fdjtSpan("dterm",query[j++]));
  var results_sum;
  if (results.length===0)
    results_sum=fdjtSpan(false," \u2192 ","no results");
  else if (results.length===1)
    results_sum=fdjtSpan(false," \u2192 ","one result");
  else results_sum=fdjtSpan(false," \u2192 ",results.length," results");
  // When the dterm has RTL content (say Hebrew), it may mess up
  //  the display of the results list, so we explicitly set the direction.
  results_sum.dir='ltr';
  fdjtAppend(head_div,results_sum);
  fdjtAppend(results_div,head_div);
  sbookShowSummaries(results,results_div,result);
}

var _sbookSearchKeyPress_delay=false;

function sbookForceComplete(input_elt)
{
  var completions=fdjtComplete(input_elt);
  var forced=false;
  if (completions.string==="") return;
  if (completions.exact.length)
    forced=completions.exact[0];
  else if (completions.length)
    forced=completions[0];
  else {}
  fdjtHandleCompletion(input_elt,forced,false);
}

function sbookSearchInput_onkeypress(evt)
{
  evt=evt||event||null;
  var ch=evt.charCode; var kc=evt.keyCode;
  var target=$T(evt);
  if ((kc===13)||(ch===13)) {
    sbookForceComplete(target);
    sbookShowSearch(sbook_query);
    sbookHUDMode("browsing");
    $("SBOOKSEARCHTEXT").blur();
    $("SBOOKSUMMARIES").focus();
    return false;}
  else if (ch===59) { /* That is, semicolon */
    sbookForceComplete($T(evt));
    if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
    evt.cancelBubble=true;}
  else {
    return fdjtComplete_onkey(evt);}
}

function sbookSearchInput_onkeyup(evt)
{
  evt=evt||event||null;
  var target=$T(evt);
  var kc=evt.keyCode;
  if (kc===13) {
    sbookForceComplete(target);
    sbookShowSearch(sbook_query);
    sbookHUDMode("browsing");
    $("SBOOKSEARCHTEXT").blur();
    $("SBOOKSUMMARIES").focus();
    if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
    evt.cancelBubble=true;
    return false;}
  else if ((kc===8)||(kc===9)) {
    sbookUpdateQuery(target);
    return fdjtComplete_onkey(evt);}
}

function sbookSearchInput_onfocus(evt)
{
  evt=evt||event||null;
  var ch=evt.charCode, kc=evt.keyCode;
  fdjtAutoPrompt_onfocus(evt);
  sbook_search_focus=true;
  sbookHUDMode("searching");
  sbookSetQuery(sbookStringToQuery($T(evt).value));
  return fdjtComplete_show(evt);
}

function sbookSearchInput_onblur(evt)
{
  evt=evt||event||null;
  // fdjtDropClass(sbookHUD,"searching");
  fdjtAutoPrompt_onblur(evt);
  sbook_search_focus=false;
}

// This is a version of the function above which changes the current
//  query.
function _sbook_replace_current_entry(elt,value)
{
  if (sbook_trace_search>1)
    fdjtLog("_sbook_replace_current_entry elt=%o value=%o",
	    elt,value);
  var curval=this.value;
  var endsemi=curval.lastIndexOf(';');
  var newval;
  if (endsemi>0)
    if (endsemi<(curval.length-1))
      newval=curval.slice(0,endsemi)+";"+value+';';
    else newval=curval+value+";";
  else newval=value+';';
  // this.value=newval;
  sbookSetQuery(newval,true);
  if ((sbook_search_gotlucky) && 
      (sbook_query._results.length>0) &&
      (sbook_query._results.length<=sbook_search_gotlucky)) {
    // fdjtTrace("Search got lucky: %o",sbook_query);
    sbookShowSearch(sbook_query);
    $("SBOOKSEARCHTEXT").blur();
    sbookHUDMode("browsing");}
  else $("SBOOKSEARCHTEXT").focus();
}

function _sbook_note_completions(completions)
{
  var forced=false;
  if (completions.exactheads.length)
    forced=completions.exactheads[0];
  else if (completions.heads.length)
    forced=completions.heads[0];
  else if (completions.exact.length)
    forced=completions.exact[0];
  else if (completions.length)
    forced=completions[0];
  else {}
  if (forced) {
    if (this.forced_elt)
      fdjtDropClass(this.forced_elt,"prime");
    this.forced_elt=forced;
    fdjtAddClass(forced,"prime");}
}

/* Getting query cloud */

function sbookDTermCompletion(dterm,title)
{
  if ((typeof dterm === "string") && (dterm[0]==="\u00A7")) {
    var showname=dterm;
    if (showname.length>17) {
      showname=showname.slice(0.17)+"...";
      title=dterm;}
    var span=fdjtSpan("completion",fdjtSpan("sectname",showname));
    span.key=dterm; span.value=dterm; span.anymatch=true;
    if (title) span.title=title;
    return span;}
  var knowde=Knowde(dterm);
  if (!(knowde))
    fdjtLog("Couldn't get knowlet references from %o",dterm);
  else if (!(knowde.dterm)) {
    fdjtLog("Got bogus dterm reference for %s: %o",dterm,knowde);
    knowde=false;}
  var dterm_node=((knowde) ? (knowde.toHTML()) : (fdjtSpan("dterm",dterm)));
  var span=fdjtSpan("completion");
  // Adds the cute hole to the vaugely tag shaped textform
  // fdjtPrepend(dterm_node,fdjtSpan("bigpunct","\u00b7"));
  if (!(title))
    if (sbook_index[dterm])
      title=sbook_index[dterm].length+" items";
    else title=false;
  if (knowde) {
    if (knowde.gloss)
      if (title)
	span.title=title+": "+fdjtStripMarkup(knowde.gloss);
      else span.title=fdjtStripMarkup(knowde.gloss);
    else span.title=title;
    /* Now add variation elements */
    var variations=[];
    var i=0; var terms=knowde.terms;
    while (i<terms.length) {
      var term=terms[i++];
      // var vary=fdjtSpan("variation","(",term,")");
      var vary=fdjtSpan("variation",term);
      vary.key=term;
      variations.push(vary);
      variations.push(" ");}
    i=0; terms=knowde.hooks;
    while (i<terms.length) {
      var term=terms[i++];
      var vary=fdjtSpan("variation",term);
      vary.key=term;
      variations.push(vary);
      variations.push(" ");}
    fdjtAppend(span,variations,dterm_node);
    span.key=knowde.dterm;
    span.value=knowde.dterm;
    span.setAttribute("dterm",knowde.dterm);}
  else {
    // This is helpful for debugging
    span.setAttribute("dterm",dterm);
    span.key=dterm; span.value=dterm;
    if (title) span.title=title;}
  return span;
}

var sbook_show_refiners=25;

function sbookQueryCloud(query)
{
  if (query._cloud) return query._cloud;
  else if ((query._query.length)===0) {
    query._cloud=sbookFullCloud();
    return query._cloud;}
  else if (!(query._refiners)) {
    result._cloud=sbook_empty_cloud;
    return query._cloud;}
  else {
    var completions=sbookMakeCloud
      (query._refiners._results,query._refiners,
       query._refiners._freqs);
    var result_counts=
      fdjtSpan("resultcounts",
	       query._results.length,
	       ((query._results.length==1) ?
		" result; " : " results; "));
    var refiner_counts=
      fdjtSpan("refinercounts",
	       query._refiners._results.length,
	       ((query._refiners._results.length==1) ?
		" term" : " terms"));
    var counts=fdjtSpan("counts",result_counts,refiner_counts);
    var n_refiners=query._refiners._results.length;
    var hide_some=(n_refiners>sbook_show_refiners);
    var msg1=
      fdjtDiv(".noinputmsg",((hide_some)?"Displaying some of ":"There are "),
	      n_refiners," possible refining terms; ",
	      "start typing to see completions.");
    var msg2=fdjtDiv(".nocompletemsg","There are no ",((n_refiners)&&("more"))," completions.");
    result_counts.onclick=function(evt){
      evt=evt||event||null;
      sbookShowSearch(query);
      sbookHUDMode("browsing");
      $("SBOOKSEARCHTEXT").blur();
      $("SBOOKSUMMARIES").focus();
      if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
      evt.cancelBubble=true;};
    result_counts.title='click to see results; click in the input box to return here';
    refiner_counts.onclick=function(evt){
      evt=evt||event||null;
      fdjtToggleClass(completions,"showempty");
      if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
      evt.cancelBubble=true;};
    refiner_counts.title='click to show more/less';
    fdjtPrepend(completions,counts,msg1,msg2);
    query._cloud=completions;
    if (hide_some) {
      var cues=$$(".cue",completions);
      if (!((cues)&&(cues.length))) {
	var compelts=$$(".completion",completions);
	var i=0; while (i<sbook_show_refiners) fdjtAddClass(compelts[i++],"cue");}}
    else fdjtAddClass(completions,"showempty");
    // fdjtTrace("Generated completions for %o: %o",query,completions);
    fdjtInitCompletions(completions);
    return completions;}
}

function sbookMakeCloud(dterms,scores,freqs)
{
  var start=new Date();
  if (sbook_trace_clouds)
    fdjtLog("[%f] Making cloud based on %d dterms using scores=%o and freqs=%o",
	    fdjtElapsedTime(),dterms.length,scores,freqs);
  var completions=fdjtDiv("completions");
  var n_terms=dterms.length;
  var i=0; var max_score=0;
  if (scores) {
    var i=0; while (i<dterms.length) {
      var score=scores[dterms[i++]];
      if ((score) && (score>max_score)) max_score=score;}}
  var copied=[].concat(dterms);
  if (freqs)
    copied.sort(function (x,y) {
	var xfreq=((freqs[x])?(freqs[x]):(0));
	var yfreq=((freqs[y])?(freqs[y]):(0));
	if (xfreq==yfreq)
	  if (x.length>y.length) return -1;
	  else if (x.length===y.length) return 0;
	  else return 1;
	else if (xfreq>yfreq) return -1;
	else return 1;});
  else copied.sort(function (x,y) {
      var xlen=((sbook_index[x])?(sbook_index[x].length):(0));
      var ylen=((sbook_index[y])?(sbook_index[y].length):(0));
      if (xlen==ylen)
	if (x.length>y.length) return -1;
	else if (x.length===y.length) return 0;
	else return 1;
      else if (xlen>ylen) return -1;
      else return 1;});
  completions.onclick=function (evt) {
    fdjtComplete_onclick(evt);
    if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
    evt.cancelBubble=true;
    return false;}
  i=0; while (i<copied.length) {
    var dterm=copied[i++];
    var count=((sbook_index[dterm]) ? (sbook_index[dterm].length) : (0));
    var freq=((freqs)?(freqs[dterm]||0):(0));
    var score=((scores) ?(scores[dterm]||false) : (false));
    var title=
      ((sbook_noisy_tooltips) ?
       (((score)?("s="+score+"; "):"")+freq+"/"+count+" items") :
       (freq+((freq==1) ? " item" : " items")));
    var relfreq=((freqs) ?
		 ((freq/freqs._count)-(count/sbook_tagged_count))
		 : (0.5));
    var span=sbookDTermCompletion(dterm,title);
    if (freq===1) fdjtAddClass(span,"singleton");
    if ((scores) && (scores[dterm])) {
      var relsize=
	Math.ceil((75+(Math.ceil(50*(score/max_score)))+
		   (Math.ceil(50*(relfreq))))
		  *((dterm.length>8) ? (2/Math.log(dterm.length)) : (1)));
      span.style.fontSize=relsize+"%";}
    fdjtAppend(completions,span,"\n");}
  /*
  var showall=fdjtSpan("showall","show completions");
  var hideall=fdjtSpan("hideall","hide completions");
  showall.onclick=fdjtComplete_toggleshowall;
  hideall.onclick=fdjtComplete_toggleshowall;
  */
  var maxmsg=fdjtDiv("maxcompletemsg",
		     "There are a lot ",
		     "(",fdjtSpan("completioncount","really"),")",
		     " of completions.  ");
  fdjtPrepend(completions,maxmsg);
  var end=new Date();
  if (sbook_trace_clouds)
    fdjtLog("[%f] Made cloud for %d dterms in %f seconds",
	    fdjtElapsedTime(),dterms.length,(end.getTime()-start.getTime())/1000);
  return completions;
}

var sbook_full_cloud=false;
var sbook_empty_cloud=false;

function sbookFullCloud()
{
  if (sbook_full_cloud) return sbook_full_cloud;
  else {
    var tagscores={}; var tagfreqs={}; var alltags=[];
    var book_tags=sbook_index._all;
    if (sbook_trace_clouds)
      fdjtLog("[%f] Making full cloud over %d tags",fdjtElapsedTime(),book_tags.length);
    // The scores here are used to determine sizes in the cloud
    // A regular index reference counts as 1 and a prime reference counts
    //  as one more.
    var i=0; while (i<book_tags.length) {
      var tag=book_tags[i++];
      var score=Math.ceil(Math.log(sbook_index[tag].length))+
	((sbook_direct_index[tag]) ? (sbook_direct_index[tag].length) : (0))+
	((sbook_prime_index[tag]) ? (sbook_prime_index[tag].length) : (0));
      if (tagscores[tag]) tagscores[tag]=tagscores[tag]+score;
      else tagscores[tag]=score;
      tagfreqs[tag]=((sbook_index[tag])?(sbook_index[tag].length):(0))
      alltags.push(tag);}
    alltags.sort(function (x,y) {
	var xlen=tagfreqs[x]; var ylen=tagfreqs[y];
	if (xlen==ylen) return 0;
	else if (xlen>ylen) return -1;
	else return 1;});
    var max_score=0;
    var i=0; while (i<alltags.length) {
      var score=tagscores[alltags[i++]];
      if (score>max_score) max_score=score;}
    var completions=sbookMakeCloud(alltags,tagscores,tagfreqs);
    sbook_full_cloud=completions;
    var cues=fdjtGetChildrenByClassName(completions,"cue");
    if (!((cues)&&(cues.length))) {
      var celts=fdjtGetChildrenByClassName(completions,"completion");
      var j=0; while ((j<sbook_show_refiners)&&(j<celts.length)) {
	fdjtAddClass(celts[j++],"cue");}}
    return completions;}
}

/* Search UI */

function createSBOOKHUDsearch()
{
  var cues=fdjtDiv(".cues#SBOOKSEARCHCUES");
  var input=fdjtInput("TEXT","QTEXT","",null);
  var completions=sbook_empty_cloud=
    fdjtDiv("completions",fdjtSpan("count","no query refinements"));
  
  fdjtAddClass(input,"autoprompt");
  input.setAttribute("COMPLETEOPTS","anywhere cloud");
  input.completions_elt=completions;
  input.prompt="Enter tags (or click on completions)";
  completions.input_elt=input;
  input.onkeypress=sbookSearchInput_onkeypress;
  input.onkeyup=sbookSearchInput_onkeyup;
  input.onfocus=sbookSearchInput_onfocus;
  input.onblur=sbookSearchInput_onblur;
  input.getCompletionText=_sbook_get_current_entry;
  input.oncomplete=_sbook_replace_current_entry;
  input.noteCompletions=_sbook_note_completions;

  // This causes a timing problem
  // input.onblur=fdjtComplete_hide;
  input.setAttribute("AUTOCOMPLETE","off");
  input.setAttribute("COMPLETIONS","SBOOKSEARCHCOMPLETIONS");
  input.setAttribute("ENTERCHARS",";");
  input.setAttribute("MAXCOMPLETE","45");  
  completions.id="SBOOKSEARCHCOMPLETIONS";
  input.id="SBOOKSEARCHTEXT";
  var sbooksearch=
    fdjtDiv(".sbooksearch.hudblock.hud",
	    fdjtDiv("#SBOOKSUMMARIES.sbookresults.hud"),
	    fdjtDiv("query",completions,fdjtDiv("input",input)),
	    cues);
  sbooksearch.onmouseover=sbookHUD_onmouseover;
  sbooksearch.onmouseout=sbookHUD_onmouseout;
  fdjtAutoPrompt_setup(sbooksearch);
  return sbooksearch;
}

function _sbook_get_current_entry()
{
  var endsemi=this.value.lastIndexOf(';');
  if (endsemi) return this.value.slice(endsemi+1);
  else return this.value;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
