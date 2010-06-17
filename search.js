/* -*- Mode: Javascript; -*- */

var sbooks_search_id="$Id$";
var sbooks_search_version=parseInt("$Revision$".slice(10,-1));

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

/*
  New design:
   sbookIndex inherits from knoduleIndex
     has methods for processing docinfo, technorati tags, etc
     KnoduleIndex has constructor method Query for creating a query object
     and doing a search
     KnoduleCloud contains the cloud code from searchui, taking
       a query
*/
     
(function(){
  function sbookIndexTags(docinfo){
    var sbook_index=sbook.index;
    /* One pass processes all of the inline KNodes and
       also separates out primary and auto tags. */
    for (var eltid in docinfo) {
      var tags=docinfo[eltid].tags;
      if (!(tags)) continue;
      var k=0; var ntags=tags.length;
      while (k<ntags) {
	var tag=tags[k];
	if (tag[0]==='*') {
	  var tagstart=tag.search(/[^*]+/);
	  tags[k]=tag=tag.slice(tagstart);
	  tags[tag]=2*tagstart;}
	else if (tag[0]==='~') tags[k]=tag=tag.slice(1);
	else tags[tag]=2;
	if ((tag.indexOf('|')>=0)) knodule.handleSubjectEntry(tag);
	k++;}}
    var knodule=sbook.knodule||false;
    sbook_index.Tags=function(item){return docinfo[item].tags;};
    for (var eltid in docinfo) {
      var tags=docinfo[eltid].tags;
      if (!(tags)) continue;
      var k=0; var ntags=tags.length;
      while (k<ntags) {
	var tag=tags[k++];
	sbook_index.add(eltid,tag,tags[tag]||1,knodule);}}}
  sbook.indexTags=sbookIndexTags;
  
  /* Inline knodules */
  function indexTechnoratiTags(kno) {
    var sbook_index=sbook.index;
    if (!(kno)) kno=knodule;
    var anchors=document.getElementsByTagName("A");
    if (!(anchors)) return;
    var i=0; var len=anchors.length;
    while (i<len)
      if (anchors[i].rel==='tag') {
	var elt=anchors[i++];
	var href=elt.href;
	var cxt=elt;
	while (cxt) if (cxt.id) break; else cxt=cxt.parentNode;
	if (!((href)&&(cxt))) return;
	var tagstart=(href.search(/[^/]+$/));
	var tag=((tagstart<0)?(href):href.slice(tagstart));
	var dterm=((kno)?(kno.handleEntry(tag)):(fdjtString.stdspace(tag)));
	sbook_index.add(cxt,dterm);}
      else i++;}
  sbook.indexTechnoratiTags=indexTechnoratiTags;
  ;})();
  
/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
