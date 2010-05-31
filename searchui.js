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

(function(){
  sbook.full_cloud=false;
  if (!(sbook.empty_cloud)) sbook.empty_cloud=false;
  if (!(sbook.show_refiners)) sbook.show_refiners=25;
  if (!(sbook.search_gotlucky)) sbook.search_gotlucky=7;

  function showSearchResults(result){
      if (!(result)) result=sbook.query;
      var results_div=fdjtDOM("div.sbooksummaries.scrollbody");
      sbookUI.setupSummaryDiv(results_div);
      showSearchSummaries(result,results_div);
      fdjtDOM.replace("SBOOKSUMMARIES",results_div);}
    sbook.showSearchResults=showSearchResults;
    
  function showSearchSummaries(result,results_div){
    var results=result._results; var head_div;
    var refiners=result._refiners;
    if (results.length===0) 
      head_div=fdjtDOM("div.sorry");
    else head_div=fdjtDOM("div.count");
    var query=result._query;
    var j=0; while (j<query.length) 
	       fdjtDOM(head_div,((j>0)&&(" \u00b7 ")),
		       fdjtDOM("span.dterm",query[j++]));
    var results_sum;
    if (results.length===0)
      results_sum=fdjtDOM("span"," \u2192 ","no results");
    else if (results.length===1)
      results_sum=fdjtDOM("span"," \u2192 ","one result");
    else results_sum=fdjtDOM("span"," \u2192 ",results.length," results");
    // When the dterm has RTL content (say Hebrew), it may mess up
    //  the display of the results list, so we explicitly set the direction.
    results_sum.dir='ltr';
    fdjtDOM(head_div,results_sum);
    fdjtDOM(results_div,head_div);
    sbookUI.showSummaries(results,results_div,result);}

  var _sbook_searchupdate=false;
  var _sbook_searchupdate_delay=200;
  
  function searchInput_onkeypress(evt){
    evt=evt||event||null;
    var ch=evt.charCode||evt.keyCode;
    var target=fdjtDOM.T(evt);
    if (_sbook_searchupdate) {
      clearTimeout(_sbook_searchupdate);
      _sbook_searchupdate=false;}
    if ((ch===13)||(ch===13)||(ch===59)) {
      if (ch===59)
	sbook.setQuery(target.value);
      else sbook.setQuery(Knowlet.Query.base(target.value));
      var qstring=Knowlet.Query.tail(target.value);
      if (!(fdjtString.isEmpty(qstring))) {
	var completeinfo=queryCloud(sbook.query);
	var completions=completeinfo.complete(qstring);
	if (completions.length) {
	  var query_base=Knowlet.Query.base(target.value);
	  var new_term=completeinfo.getValue(completions[0]);
	  var new_query=(query_base+new_term+";");
	  sbook.setQuery(new_query,true);}}
      else {
	var completeinfo=queryCloud(sbook.query);
	completeinfo.complete("");}
      fdjtDOM.cancel(evt);
      if ((ch===13)||
	  ((sbook.search_gotlucky) && 
	   (sbook.query._results.length>0) &&
	   (sbook.query._results.length<=sbook.search_gotlucky))) {
	showSearchResults(sbook.query);
	sbookMode("browsing");
	fdjtID("SBOOKSEARCHTEXT").blur();
	fdjtID("SBOOKSUMMARIES").focus();}
      else {
	/* Handle new info */
	var completeinfo=queryCloud(sbook.query);
	completeinfo.complete("");}
      return false;}
    else if (ch==32) { /* Space */
      var qstring=Knowlet.Query.tail(target.value);
      var completeinfo=queryCloud(sbook.query);
      var completions=completeinfo.complete(qstring);
      if (completions.prefix!==qstring) {
	target.value=Knowlet.Query.base(target.value)+';'+completions.prefix;
	fdjtDOM.cancel(evt);
	return;}}
    else {
      var completeinfo=queryCloud(sbook.query);
      _sbook_searchupdate=
	setTimeout(function(){
	    completeinfo.complete(Knowlet.Query.tail(target.value));},
	  _sbook_searchupdate_delay);}}
  sbookUI.handlers.SearchInput_onkeypress=searchInput_onkeypress;

  function searchInput_onkeyup(evt){
    evt=evt||event||null;
    var kc=evt.keyCode;
    if ((kc===8)||(kc===45)) {
      if (_sbook_searchupdate) {
	clearTimeout(_sbook_searchupdate);
	_sbook_searchupdate=false;}
      var target=fdjtDOM.T(evt);
      _sbook_searchupdate=
	setTimeout(function(target){
	    _sbook_searchupdate=false;
	    searchUpdate(target);},
	  _sbook_searchupdate_delay,target);}}
  sbookUI.handlers.SearchInput_onkeyup=searchInput_onkeyup;

  function searchUpdate(input,cloud){
    if (!(input)) input=fdjtID("SBOOKSEARCHTEXT");
    var base=Knowlet.Query.base(input.value);
    var end=Knowlet.Query.tail(input.value);
    sbook.setQuery(Knowlet.Query.string2query(base));
    queryCloud(sbook.query).complete(end);}
  sbook.searchUpdate=searchUpdate;

  function searchInput_onfocus(evt){
    evt=evt||event||null;
    var input=fdjtDOM.T(evt);
    fdjtUI.AutoPrompt.onfocus(evt);
    sbook_search_focus=true;
    sbookMode("searching");
    searchUpdate(input);}
  sbookUI.handlers.SearchInput_onfocus=searchInput_onfocus;

  function searchInput_onblur(evt){
    evt=evt||event||null;
    fdjtUI.AutoPrompt.onblur(evt);
    sbook_search_focus=false;}
  sbookUI.handlers.SearchInput_onblur=searchInput_onblur;

  function clearInput_onclick(evt){
    var input_elt=fdjtID("SBOOKSEARCHTEXT");
    input_elt.value='';
    sbookUpdateQuery(input_elt);
    input_elt.focus();}
  sbookUI.handlers.ClearInput_onclick=clearInput_onclick;
  
  sbook.toggleSearch=function(evt){
    evt=evt||event;
    if ((sbook.mode==="searching")||(sbook.mode==="browsing"))
      sbookMode(false);
    else {
      sbookMode("searching");
      fdjtID("SBOOKSEARCHTEXT").focus();}
    fdjtUI.cancel(evt);};
  
  /* Getting query cloud */

  function queryCloud(query){
    if (query._cloud) return query._cloud;
    else if ((query._query.length)===0) {
      query._cloud=FullCloud();
      return query._cloud;}
    else if (!(query._refiners)) {
      result._cloud=sbook.empty_cloud;
      return query._cloud;}
    else {
      var completions=makeCloud
	(query._refiners._results,
	 ((query._simple)?(query._refiners._freqs):(query._refiners)),
	 query._refiners._freqs);
      completions.onclick=Cloud_onclick;
      var result_counts=
	fdjtDOM("span.resultcounts",
		query._results.length,
		((query._results.length==1) ?
		 " result; " : " results; "));
      var refiner_counts=
	fdjtDOM("span.refinercounts",
		query._refiners._results.length,
		((query._refiners._results.length==1) ?
		 " refiner" : " refiners"));
      var counts=fdjtDOM("span.counts",result_counts,refiner_counts);
      var n_refiners=query._refiners._results.length;
      var hide_some=(n_refiners>sbook.show_refiners);
      var msg1=
	fdjtDOM("div.noinputmsg",((hide_some)?"Some of ":"There are "),
		n_refiners," possible refining terms");
      var msg2=fdjtDOM
	("div.nocompletemsg",
	 "There are no ",((n_refiners)&&("more"))," completions");
      result_counts.title=
	'click to see results; click in the input box to return here';
      refiner_counts.title='click to show more/fewer refiners';
      fdjtDOM.prepend(completions,counts,msg1,msg2);
      if (hide_some) {
	var cues=fdjtDOM.$(".cue",completions);
	if (!((cues)&&(cues.length))) {
	  var compelts=fdjtDOM.$(".completion",completions);
	  var i=0; var lim=((compelts.length<sbook.show_refiners)?
			    (compelts.length):(sbook.show_refiners));
	  while (i<lim) fdjtDOM.addClass(compelts[i++],"cue");}}
      else fdjtDOM.addClass(completions,"showempty");

      query._cloud=
	new fdjtUI.Completions(completions,fdjtID("SBOOKSEARCHTEXT"));

      return query._cloud;}}
  sbook.queryCloud=queryCloud;

  function Cloud_onclick(evt){
    evt=evt||event;
    var target=fdjtDOM.T(evt);
    var completion=fdjtDOM.getParent(target,".completion");
    if (completion) {
      var cinfo=sbook.query._cloud;
      var value=cinfo.getValue(completion);
      add_searchtag(value);
      fdjtDOM.cancel(evt);}
    else if (fdjtDOM.inherits(target,".resultcounts")) {
      showSearchResults(sbook.query);
      sbookMode("browsing");
      fdjtID("SBOOKSEARCHTEXT").blur();
      fdjtID("SBOOKSUMMARIES").focus();
      fdjtDOM.cancel(evt);}
    else if (fdjtDOM.inherits(target,".refinercounts")) {
      var completions=fdjtDOM.getParent(target,".completions");
      fdjtDOM.toggleClass(completions,"showempty");
      fdjtDOM.cancel(evt);}
    else if (fdjtDOM.inherits(target,".maxcompletemsg")) {
      var completions=fdjtDOM.getParent(target,".completions");
      fdjtID("SBOOKSEARCHTEXT").focus();
      fdjtDOM.toggleClass(container,"showall");
      fdjtDOM.cancel(evt);}
    else {}}
  sbookUI.handlers.Cloud_onclick=Cloud_onclick;

  function makeCloud(dterms,scores,freqs,noscale){
    var sbook_index=sbook.index;
    var start=new Date();
    if (sbook.Trace.clouds)
      fdjtLog("[%fs] Making cloud from %d dterms using scores=%o and freqs=%o",
	      fdjtET(),dterms.length,scores,freqs);
    var spans=fdjtDOM("span");  
    var completions=fdjtDOM("div.completions",spans);
    var n_terms=dterms.length;
    var i=0; var max_score=0;
    if (scores) {
      var i=0; while (i<dterms.length) {
	var score=scores[dterms[i++]];
	if ((score) && (score>max_score)) max_score=score;}}
    var copied=[].concat(dterms);
    var bykey=sbook_index.bykey;
    if (freqs)
      copied.sort(function (x,y) {
	  var xfreq=((freqs[x])?(freqs[x]):(0));
	  var yfreq=((freqs[y])?(freqs[y]):(0));
	  if (xfreq==yfreq)
	    if (x>y) return -1;
	    else if (x===y) return 0;
	    else return 1;
	  else if (xfreq>yfreq) return -1;
	  else return 1;});
    else copied.sort(function (x,y) {
	var xlen=((bykey[x])?(bykey[x].length):(0));
	var ylen=((bykey[y])?(bykey[y].length):(0));
	if (xlen==ylen)
	  if (x>y) return -1;
	  else if (x===y) return 0;
	  else return 1;
	else if (xlen>ylen) return -1;
	else return 1;});
    var nspans=0; var sumscale=0; var minscale=false;
    i=0; while (i<copied.length) {
      var dterm=copied[i++];
      var count=((bykey[dterm]) ? (bykey[dterm].length) : (0));
      var freq=((freqs)?(freqs[dterm]||0):(0));
      var score=((scores) ?(scores[dterm]||false) : (false));
      var title=
	((sbook.noisy_tooltips) ?
	 (dterm+": "+(((score)?("s="+score+"; "):"")+freq+"/"+count+" items")) :
	 (dterm+": "+freq+((freq==1) ? " item" : " items")));
      var span=DTermCompletion(dterm,title);
      if (freq===1) fdjtDOM.addClass(span,"singleton");
      if ((freqs)&&(!(noscale))) {
	var relfreq=((freq/freqs._count)/(count/sbook.docinfo._eltcount));
	var scaling=Math.sqrt(relfreq);
	var fontscale=100+(scaling*100);
	sumscale=fontscale+sumscale; nspans++;
	if ((minscale===false)||(fontscale<minscale)) minscale=fontscale;
	span.style.fontSize=fontscale+"%";}
      fdjtDOM(spans,span,"\n");}
    if ((freqs)&&(!(noscale))) {
      var avgscale=sumscale/nspans;
      var scaledown=7500/minscale; // 10000/avgscale;
      spans.style.fontSize=scaledown+"%";
      spans.style.lineHeight=avgscale+"%";}
    var maxmsg=fdjtDOM
      ("div.maxcompletemsg",
       "There are a lot ","(",fdjtDOM("span.completioncount","really"),")",
       " of completions.  ");
    fdjtDOM.prepend(completions,maxmsg);
    var end=new Date();
    if (sbook.Trace.clouds)
      fdjtLog("[%f] Made cloud for %d dterms in %f seconds",
	      fdjtET(),dterms.length,
	      (end.getTime()-start.getTime())/1000);

    return completions;}
  sbook.makeCloud=makeCloud;

  function DTermCompletion(term,title){
    var sbook_index=sbook.index;
    if ((typeof term === "string") && (term[0]==="\u00A7")) {
      var showname=term;
      if (showname.length>17) {
	showname=showname.slice(0,17)+"...";
	title=term;}
      var span=fdjtDOM("span.completion",fdjtDOM("span.sectname",showname));
      span.key=term; span.value=term; span.anymatch=true;
      if (title)
	span.title="("+term+": "+sbook_index.freq(term)+" items) "+title;
      else span.title=term+": "+sbook_index.freq(term)+" items";
      return span;}
    var dterm=sbook.knowlet.DTerm(term);
    if (!(dterm))
      fdjtLog("Couldn't get knowlet references from %o",dterm);
    else if (!(dterm.dterm)) {
      fdjtLog("Got bogus dterm reference for %s: %o",term,dterm);
      dterm=false;}
    var dterm_node=
      ((dterm) ? (dterm.toHTML()) : (fdjtDOM("span.dterm.raw",term)));
    if (!(title))
      if (sbook_index.freq(dterm))
	title=dterm+": "+sbook_index.freq(dterm)+" items";
      else title=false;
    var span=fdjtDOM("span.completion");
    if (dterm) {
      if (dterm.gloss)
	if (title) span.title=title+": "+dterm.gloss;
	else span.title=dterm.gloss;
      else span.title=title;
      /* Now add variation elements */
      var variations=[];
      var i=0; var terms=dterm.getSet('EN');
      while (i<terms.length) {
	var term=terms[i++];
	if (term===dterm.dterm) continue;
	var vary=fdjtDOM("span.variation",term);
	vary.key=term;
	span.appendChild(vary);
	span.appendChild(document.createTextNode(" "));}
      span.appendChild(dterm_node);
      span.key=dterm.dterm;
      span.value=dterm.dterm;
      span.setAttribute("dterm",dterm.dterm);}
    else {
      // This is helpful for debugging
      span.setAttribute("dterm",dterm);
      span.key=dterm; span.value=dterm;
      if (title) span.title=title;}
    return span;}
  
  function add_searchtag(value){
    var input=fdjtID("SBOOKSEARCHTEXT");
    var curval=input.value;
    var endsemi=curval.lastIndexOf(';');
    var newval;
    if (endsemi>0)
      if (endsemi<(curval.length-1))
	newval=curval.slice(0,endsemi)+";"+value+';';
      else newval=curval+value+";";
    else newval=value+";";
    sbook.setQuery(newval);
    if ((sbook.search_gotlucky) && 
	(sbook.query._results.length>0) &&
	(sbook.query._results.length<=sbook.search_gotlucky)) {
      // fdjtTrace("Search got lucky: %o",sbook.query);
      showSearchResults(sbook.query);
      fdjtID("SBOOKSEARCHTEXT").blur();
      sbookMode("browsing");}
    else fdjtID("SBOOKSEARCHTEXT").focus();}

  function FullCloud(){
    if (sbook.full_cloud) return sbook.full_cloud;
    else {
      var tagscores=sbook.index.tagScores();
      var alltags=tagscores._all;
      var tagfreqs=tagscores._freq;
      var completions=sbook.makeCloud(alltags,tagfreqs,tagfreqs,true);
      var cues=fdjtDOM.getChildren(completions,".cue");
      if (!((cues)&&(cues.length))) {
	var celts=fdjtDOM.getChildren(completions,".completion");
	var j=0; while ((j<sbook.show_refiners)&&(j<celts.length)) {
	  fdjtDOM.addClass(celts[j++],"cue");}}
      completions.onclick=Cloud_onclick;
      sbook.full_cloud=new fdjtUI.Completions(completions);
      return sbook.full_cloud;}}
  sbook.FullCloud=FullCloud;
 })();
    

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
