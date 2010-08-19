/* -*- Mode: Javascript; -*- */

var sbooks_searchui_id="$Id$";
var sbooks_searchui_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009 beingmeta, inc.
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

(function(){
    sbook.full_cloud=false;
    if (!(sbook.empty_cloud)) sbook.empty_cloud=false;
    if (!(sbook.show_refiners)) sbook.show_refiners=25;
    if (!(sbook.search_gotlucky)) sbook.search_gotlucky=7;
    
    /* Query functions */


    /* Set on main search input */
    // id="SBOOKSEARCHINPUT" 
    // completions="SBOOKSEARCHCLOUD"

    var Query=KnoduleIndex.Query;

    sbook.getQuery=function(){return sbook.query;}
    
    function setQuery(query){
      if (sbook.Trace.search) fdjtLog("Setting working query to %o",query);
      sbook.query=useQuery(query,fdjtID("SBOOKSEARCH"));}

    sbook.setQuery=setQuery;

    function useQuery(query,box_arg){
	var result;
	if (query instanceof Query) result=query;
	else result=sbook.index.Query(query);
	var qstring=result.getString();
	if ((box_arg)&&(typeof box_arg === 'string'))
	    box_arg=document.getElementById(box_arg);
	var box=box_arg||result._box||fdjtID("SBOOKSEARCH");
	if ((query.dom)&&(box)&&(box!==query.dom))
	  fdjtDOM.replace(box_arg,query.dom);
	if (qstring===box.getAttribute("qstring")) {
	  fdjtLog("[%fs] No change in query for %o to %o: %o/%o (%o)",
		  fdjtET(),box,result._query,result,result._refiners,qstring);
	  return;}
	if (sbook.Trace.search>1)
	    fdjtLog("[%fs] Setting query for %o to %o: %o/%o (%o)",
		    fdjtET(),box,result._query,result,result._refiners,qstring);
	else if (sbook.Trace.search)
	    fdjtLog("[%fs] Setting query for %o to %o: %d results/%d refiners (%o)",
		    fdjtET(),box,result._query,result._results.length,
		    result._refiners._results.length,qstring);
	var input=fdjtDOM.getChild(box,".searchinput");
	var cloudid=input.getAttribute("completions");
	var resultsid=input.getAttribute("results");
	var qtags=fdjtDOM.getChild(box,".qtags");
	var cloud=((cloudid)&&(fdjtID(cloudid)))||
	    fdjtDOM.getChild(box,".searchcloud");
	var results=((resultsid)&&(fdjtID(resultsid)))||
	    fdjtDOM.getChild(box,".searchresults");
	var resultcount=fdjtDOM.getChild(box,".resultcount");
	var refinecount=fdjtDOM.getChild(box,".refinecount");
	// Update (clear) the input field
	input.value=''; fdjtDOM.addClass(input,"isempty");
	var elts=result._query; var i=0; var lim=elts.length;
	// Update 'notags' class
	if (elts.length) fdjtDOM.dropClass(box,"notags");
	else fdjtDOM.addClass(box,"notags");
	// Update the query tags
	var newtags=fdjtDOM("span.qtags");
	while (i<lim) {
	    var tag=elts[i];
	    if (typeof tag === 'string') tag=fdjtKB.ref(tag)||tag;
	    if (i>0) fdjtDOM(newtags," \u00B7 ");
	    if (typeof tag === "string")
		fdjtDOM(newtags,fdjtDOM("span.dterm",tag));
	    else if (tag.kind)
		fdjtDOM(newtags,tag.name);
	    else fdjtDOM(newtags,tag);
	    i++;}
	if (qtags.id) newtags.id=qtags.id;
	fdjtDOM.replace(qtags,newtags);
	// Update the results display
	if (result._results.length) {
	    resultcount.innerHTML=result._results.length+
		" passage"+((result._results.length===1)?"":"s");
	    fdjtDOM.dropClass(box,"noresults");}
	else {
	    resultcount.innerHTML="no results";
	    fdjtDOM.addClass(box,"noresults");}
	// Update the search cloud
	var n_refiners=
	    ((result._refiners)&&(result._refiners._results.length))||0;
	if (n_refiners) {
	    var completions=sbook.queryCloud(result);
	    refinecount.innerHTML=n_refiners+
		((n_refiners===1)?(" association"):(" associations"));
	    fdjtDOM.dropClass(box,"norefiners");
	    if (cloudid) completions.id=cloudid;
	    if (sbook.Trace.search>1)
		fdjtLog("[%fs] Setting search cloud for %o to %o",
			fdjtET(),box,completions.dom);
	    fdjtDOM.replace(cloud,completions.dom);
	    completions.complete("");}
	else {
	    fdjtDOM.addClass(box,"norefiners");
	    refinecount.innerHTML="no refiners";}
	result._box=box; box.setAttribute(qstring,qstring);
	return result;}
    sbook.useQuery=useQuery;

    function extendQuery(query,elt){
	var elts=[].concat(query._query);
	if (typeof elt === 'string') 
	    elts.push(fdjtKB.ref(elt)||elt);
	else elts.push(elt);
	return useQuery(query.index.Query(elts),query._box);}
    sbook.extendQuery=extendQuery;

    sbook.updateQuery=function(input_elt){
	var q=Knodule.Query.string2query(input_elt.value);
	if ((q)!==(sbook.query._query))
	    sbook.setQuery(q,false);};

    function showSearchResults(){
	fdjtDOM.replace("SBOOKSEARCHRESULTS",sbook.query.showResults());
	sbookMode("browsing");
	fdjtID("SBOOKSEARCHINPUT").blur();
	fdjtID("SBOOKSEARCHRESULTS").focus();}
    sbook.showSearchResults=showSearchResults;

    /* Call this to search */

    function startSearch(tag){
	setQuery([tag]);
	sbookMode("searching");}
    sbook.startSearch=startSearch;

    /* Text input handlers */

    var _sbook_searchupdate=false;
    var _sbook_searchupdate_delay=200;
    
    function searchInput_onkeypress(evt){
	evt=evt||event||null;
	var ch=evt.charCode||evt.keyCode;
	var target=fdjtDOM.T(evt);
	// fdjtLog("[%fs] Input %o on %o",fdjtET(),evt,target);
	// Clear any pending completion calls
	if (_sbook_searchupdate) {
	    clearTimeout(_sbook_searchupdate);
	    _sbook_searchupdate=false;}
	if ((ch===13)||(ch===13)||(ch===59)||(ch===93)) {
	    var qstring=target.value;
	    if (fdjtString.isEmpty(qstring)) {
		fdjtDOM.replace("SBOOKSEARCHRESULTS",sbook.query.showResults());
		sbookMode("browsing");
		fdjtID("SBOOKSEARCHINPUT").blur();
		fdjtID("SBOOKSEARCHRESULTS").focus();}
	    else {
		var completeinfo=queryCloud(sbook.query);
		var completions=completeinfo.complete(qstring);
		if (completions.length) {
		    sbook.query=
			extendQuery(sbook.query,completeinfo.getValue(completions[0]));}}
	    fdjtDOM.cancel(evt);
	    if ((sbook.search_gotlucky) && 
		(sbook.query._results.length>0) &&
		(sbook.query._results.length<=sbook.search_gotlucky)) {
		fdjtDOM.replace("SBOOKSEARCHRESULTS",sbook.query.showResults());
		sbookMode("browsing");
		fdjtID("SBOOKSEARCHINPUT").blur();
		fdjtID("SBOOKSEARCHRESULTS").focus();}
	    else {
		/* Handle new info */
		var completeinfo=queryCloud(sbook.query);
		completeinfo.complete("");}
	    return false;}
	else if (ch==32) { /* Space */
	    var qstring=target.value;
	    var completeinfo=queryCloud(sbook.query);
	    var completions=completeinfo.complete(qstring);
	    if (completions.prefix!==qstring) {
		target.value=completions.prefix;
		fdjtDOM.cancel(evt);
		return;}}
	else {
	    var completeinfo=queryCloud(sbook.query);
	    _sbook_searchupdate=
		setTimeout(function(){
		    completeinfo.complete(target.value);},
			   _sbook_searchupdate_delay);}}
    sbook.UI.handlers.search_onkeypress=searchInput_onkeypress;

    function searchInput_onkeyup(evt){
	evt=evt||event||null;
	var kc=evt.keyCode;
	if ((kc===8)||(kc===46)) {
	    if (_sbook_searchupdate) {
		clearTimeout(_sbook_searchupdate);
		_sbook_searchupdate=false;}
	    var target=fdjtDOM.T(evt);
	    _sbook_searchupdate=
		setTimeout(function(target){
		    _sbook_searchupdate=false;
		    searchUpdate(target);},
			   _sbook_searchupdate_delay,target);}}
    sbook.UI.handlers.SearchInput_onkeyup=searchInput_onkeyup;

    function searchUpdate(input,cloud){
	if (!(input)) input=fdjtID("SBOOKSEARCHINPUT");
	if (!(cloud)) cloud=queryCloud(sbook.query);
	cloud.complete(input.value);}
    sbook.searchUpdate=searchUpdate;

    function searchInput_onfocus(evt){
	evt=evt||event||null;
	var input=fdjtDOM.T(evt);
	fdjtUI.AutoPrompt.onfocus(evt);
	sbook_search_focus=true;
	if ((sbook.mode)&&(sbook.mode==='browsing'))
	    sbookMode("searching");
	searchUpdate(input);}
    sbook.UI.handlers.search_onfocus=searchInput_onfocus;

    function searchInput_onblur(evt){
	evt=evt||event||null;
	fdjtUI.AutoPrompt.onblur(evt);
	sbook_search_focus=false;}
    sbook.UI.handlers.search_onblur=searchInput_onblur;

    function clearSearch(evt){
	var target=fdjtUI.T(evt||event);
	var box=fdjtDOM.getParent(target,".searchbox");
	var input=fdjtDOM.getChild(box,".searchinput");
	setQuery(sbook.empty_query);
	input.focus();}
    sbook.UI.handlers.clearSearch=clearSearch;
    
    sbook.toggleSearch=function(evt){
	evt=evt||event;
	if ((sbook.mode==="searching")||(sbook.mode==="browsing"))
	    sbookMode(false);
	else {
	    sbookMode("searching");
	    fdjtID("SBOOKSEARCHINPUT").focus();}
	fdjtUI.cancel(evt);};
    
    /* Show search results */

    function makelocrule(target_info,cxtinfo_arg,cxtname){
	var cxtinfo=cxtinfo_arg||sbook.docinfo[(sbook.body||document.body).id];
	if (!(cxtname)) {
	    if (cxtinfo_arg) cxtname="into the section";
	    else cxtname="into the book";}
	var locrule=fdjtDOM("hr.locrule");
	var cxt_start=cxtinfo.starts_at;
	var cxt_end=cxtinfo.ends_at;
	var cxt_len=cxt_end-cxt_start;
	var target_start=target_info.starts_at-cxt_start;
	var target_len=target_info.ends_at-target_info.starts_at;
	var locstring="~"+Math.ceil(target_len/5)+ " words long ~"+
	    Math.ceil((target_start/cxt_len)*100)+"% "+cxtname;
	locrule.setAttribute("about","#"+(target_info.id||target_info.frag));
	locrule.locstring=locstring+".";
	locrule.title=locstring+": click or hold to glimpse";
	locrule.style.width=((target_len/cxt_len)*100)+"%";
	locrule.style.left=((target_start/cxt_len)*100)+"%";
	return locrule;}

    function sumText(target){
	var text=
	    fdjtString.trim(
		sbook.getTitle(target)||fdjtDOM.textify(target));
	return text.replace(/\n\n+/g," // ");}

    function resultHead(hinfo){
	var jumper1=fdjtDOM.Anchor(
	    "javascript:sbook.JumpTo('"+hinfo.frag+"');",
	    "a.spacer","\u00A7");
	var jumper2=fdjtDOM.Anchor(
	    "javascript:sbook.JumpTo('"+hinfo.frag+"');",
	    "a.head",hinfo.title);
	var head=fdjtDOM("div.head",makelocrule(hinfo),jumper1," ",jumper2);
	jumper2.title=jumper1.title="jump to this section";
	head.setAttribute("about","#"+(hinfo.frag));
	return head;}
    function resultPassage(target,info){
	var text=sumText(target);
	var jumper=
	    fdjtDOM.Anchor(
		"javascript:sbook.JumpTo('"+info.frag+"');",
		"a.spacer","\u00b6");
	jumper.title="jump to this passage";
	var head=fdjtDOM("div.passage",
			 makelocrule(info,info.head),
			 jumper," ",fdjtDOM("span.text",text));
	head.setAttribute("about","#"+(info.frag));
	head.title=text;
	return head;}

    function showResults(result){
	var allids=[]; var rscores=result._scores;
	var scores={}; var tags={}; var refs={}; var glosses={};
	if (result._results_div) return result._results_div;
	var results=result._results;
	var i=0; var lim=results.length;
	while (i<lim) {
	    var r=results[i++];
	    var ref=sbook.docinfo[r]||sbook.glosses.map[r];
	    if (!(ref)) continue;
	    var frag=ref.frag;
	    if (ref.tstamp) fdjtKB.add(glosses,frag,r);
	    if (scores[frag]) 
		scores[frag]=scores[frag]+(rscores[r]||1);
	    else {
		allids.push(frag);
		scores[frag]=rscores[r];}}
	allids.sort(function(x,y){
	    if (scores[x]>scores[y]) return -1;
	    else if (scores[x]<scores[y]) return 1;
	    else return 0;});
	if (!(result)) result=sbook.query;
	var div=fdjtDOM("div.sbookslice.sbookresults");
	sbook.UI.setupSummaryDiv(div);
	i=0; lim=allids.length;
	while (i<lim) {
	    var id=allids[i++];
	    var info=sbook.docinfo[id];
	    var elt=document.getElementById(id);
	    var text=fdjtDOM.textify(elt);
	    var headinfo=info.head;
	    var head=fdjtDOM("div.head",headinfo.title);
	    var passage=fdjtDOM("div.passage",text);
	    passage.title=text;
	    fdjtDOM(div,
		    fdjtDOM("div.sbookresult",
			    resultHead(headinfo),
			    resultPassage(elt,info),
			    sbook.glossBlock(id,false,[],glosses[id],true)));}
	result._results_div=div;
	return div;}
    KnoduleIndex.Query.prototype.showResults=
	function(){return showResults(this);};
    
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
	    var n_refiners=query._refiners._results.length;
	    var hide_some=(n_refiners>sbook.show_refiners);
	    if (hide_some) {
		var cues=fdjtDOM.$(".cue",completions);
		if (!((cues)&&(cues.length))) {
		    var compelts=fdjtDOM.$(".completion",completions);
		    var i=0; var lim=((compelts.length<sbook.show_refiners)?
				      (compelts.length):(sbook.show_refiners));
		    while (i<lim) fdjtDOM.addClass(compelts[i++],"cue");}}
	    else fdjtDOM.addClass(completions,"showempty");

	    query._cloud=
		new fdjtUI.Completions(completions,fdjtID("SBOOKSEARCHINPUT"));

	    return query._cloud;}}
    sbook.queryCloud=queryCloud;
    KnoduleIndex.Query.prototype.getCloud=function(){return queryCloud(this);};

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
	    fdjtID("SBOOKSEARCHINPUT").blur();
	    fdjtID("SBOOKSEARCHRESULTS").focus();
	    fdjtDOM.cancel(evt);}
	else if (fdjtDOM.inherits(target,".refinercounts")) {
	    var completions=fdjtDOM.getParent(target,".completions");
	    fdjtDOM.toggleClass(completions,"showempty");
	    fdjtDOM.cancel(evt);}
	else if (fdjtDOM.inherits(target,".maxcompletemsg")) {
	    var completions=fdjtDOM.getParent(target,".completions");
	    fdjtID("SBOOKSEARCHINPUT").focus();
	    fdjtDOM.toggleClass(container,"showall");
	    fdjtDOM.cancel(evt);}
	else {}}
    sbook.UI.handlers.Cloud_onclick=Cloud_onclick;

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
	    var span=KNodeCompletion(dterm,title);
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
	    fdjtLog("[%fs] Made cloud for %d dterms in %f seconds",
		    fdjtET(),dterms.length,
		    (end.getTime()-start.getTime())/1000);

	return completions;}
    sbook.makeCloud=makeCloud;

    function KNodeCompletion(term,title){
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
	var dterm=sbook.knodule.KNode(term);
	if (!(dterm))
	    fdjtLog("Couldn't get knodule references from %o",dterm);
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
	sbook.query=sbook.extendQuery(sbook.query,value);}

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
